"""
Wise portal service — MongoDB-backed.

Queries the shared MongoDB database (same one the presales CRM backend writes to).
Falls back to mock data when MONGO_CONNECTION_STRING is not set.

Key collections:
  sessions              — transcripts, student/teacher info, TT analytics
                          student_id (Wise numeric ID), wise_session_id links to status
  wise_status_sessions  — all scheduled sessions including no-shows
                          sessionId links to sessions.wise_session_id
                          studentName used for attendance lookup (studentId is never set)
                          scheduledTime_dt is the proper datetime field
                          subject is the Wise batch code e.g. "AUS-3621-Priyank-0226-Maths-3"
"""

import calendar
import logging
import os
import re
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Batch code pattern: "AUS-3621-Priyank-0226-Maths-3"
# parts[-2] = subject name, parts[-1] = grade level
_BATCH_SUBJECT_RE = re.compile(
    r"^(?:AUS|UK|US|USA|NEW|NZ)-\w+-[\w ]+-\w+-([\w ]+)-\w+$", re.IGNORECASE
)

# Tokens the batch code uses as a grade-level or placeholder rather than a
# real subject. If the regex pulls one of these out (e.g. "AUS-…-Grade-5"),
# treat the subject as missing instead of shipping a student labelled "Grade".
_NON_SUBJECT_TOKENS = {"grade", "level", "class", "session"}

# Known subject names (lowercase). Used for two recovery paths:
#   1. Direct-match — when the whole batch_code is just a subject string
#      (e.g. "English" or "maths") rather than the full dash-separated form.
#   2. 5-segment fallback — when the trailing grade level is missing
#      ("AUS-7547-Kiaan-1808-Math") and we need to look at parts[-1].
# Add new offerings here when they show up; missing entries still extract via
# the regex when the batch code follows the standard 6-segment shape.
_KNOWN_SUBJECTS = {
    "maths", "math", "mathematics", "english", "science", "coding",
    "reasoning", "chemistry", "physics", "biology", "hindi", "french",
    "spanish", "public speaking", "creative writing", "social studies",
    "history", "geography", "computer", "programming", "logic",
    "critical thinking", "art", "music", "chess", "abacus", "business",
    "naplan", "vedic maths", "financial literacy", "11+exam prep",
    "thinking skills", "confident speech", "confidence building",
    "public communication", "other", "others",
}


def _extract_subject_from_batch_code(batch_code: str) -> str:
    """Best-effort subject extraction from a Wise batch code.

    Recognized shapes:
      'AUS-3621-Priyank-0226-Maths-3'  → 'Maths'
      'AUS-7547-Kiaan-1808-Math'       → 'Math'        (missing trailing grade)
      'English'                        → 'English'     (bare subject)

    Returns "" when we can't recover a real subject (caller should default
    to "General"). Notably never returns 'Grade' / 'Level' / 'Class' even
    when those literally appear in the batch code, since they're grade-level
    placeholders rather than subject names.
    """
    s = (batch_code or "").strip()
    if not s:
        return ""

    # 1) Direct-match: the whole batch code is a known subject string.
    if s.lower() in _KNOWN_SUBJECTS:
        return s.title()

    # 2) Standard 6-segment shape via the regex.
    m = _BATCH_SUBJECT_RE.match(s)
    if m:
        candidate = m.group(1).strip()
        if candidate.lower() in _NON_SUBJECT_TOKENS:
            return ""
        return candidate.title()

    # 3) Dash-split fallback. Prefer parts[-2] (the standard "subject-grade"
    #    tail). When -2 is a digit, try parts[-1] if it looks like a known
    #    subject — handles 5-segment codes that omit the trailing grade.
    parts = s.split("-")
    if len(parts) >= 2:
        candidate = parts[-2].strip()
        if (
            candidate
            and not candidate.isdigit()
            and candidate.lower() not in _NON_SUBJECT_TOKENS
        ):
            return candidate.title()
    if parts:
        last = parts[-1].strip()
        if last and not last.isdigit() and last.lower() in _KNOWN_SUBJECTS:
            return last.title()
    return ""


def _month_range(month: str) -> tuple[datetime, datetime]:
    """'2026-05-01' → (UTC start of month, UTC end of month)"""
    parts = month.split("-")
    year, mon = int(parts[0]), int(parts[1])
    last_day = calendar.monthrange(year, mon)[1]
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    end = datetime(year, mon, last_day, 23, 59, 59, tzinfo=timezone.utc)
    return start, end


def _summarise_transcript(transcript: str, max_chars: int = 500) -> str:
    """Trim a full session transcript to a usable summary for the Claude prompt."""
    text = (transcript or "").strip()
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars]
    last_period = cut.rfind(".")
    return (cut[: last_period + 1] if last_period > max_chars // 2 else cut).strip()


# ── MongoDB path ─────────────────────────────────────────────────────────────

async def _mongo_get_student_month_data(student_id: str, month: str) -> dict | None:
    from db.mongo import get_mongo_db
    db = get_mongo_db()
    sessions_col = db["sessions"]
    status_col = db["wise_status_sessions"]

    start_dt, end_dt = _month_range(month)
    date_filter = {"$gte": start_dt, "$lte": end_dt}

    # 1. Sessions with transcripts = student attended
    attended_docs = await sessions_col.find(
        {
            "student_id": student_id,
            "last_wise_event": "SessionTranscriptGeneratedEvent",
            "transcript": {"$nin": [None, ""]},
            "wise_event_received_at": date_filter,
        },
        {
            "transcript": 1,
            "summary": 1,
            "teacher_name": 1,
            "student_name": 1,
            "wise_session_id": 1,
        },
    ).to_list(None)

    attended = len(attended_docs)

    # Pull student / teacher names from session docs
    student_name = ""
    teacher_name = ""
    for doc in attended_docs:
        if not student_name:
            student_name = str(doc.get("student_name") or "").strip()
        if not teacher_name:
            teacher_name = str(doc.get("teacher_name") or "").strip()
        if student_name and teacher_name:
            break

    # 2. Total scheduled sessions (including no-shows) via wise_status_sessions
    #    wise_status_sessions.studentId is never populated, so match by studentName + scheduledTime_dt
    total_classes = attended
    no_shows = 0
    subject = ""

    if student_name:
        total_classes = await status_col.count_documents(
            {
                "studentName": student_name,
                "scheduledTime_dt": date_filter,
            }
        )
        if total_classes < attended:
            # Sanity: attended can't exceed total
            total_classes = attended
        no_shows = max(0, total_classes - attended)

        # Subject from the batch code stored in wise_status_sessions.subject
        status_doc = await status_col.find_one(
            {"studentName": student_name}, {"subject": 1}
        )
        if status_doc:
            subject = _extract_subject_from_batch_code(str(status_doc.get("subject") or ""))

    if total_classes == 0 and attended == 0:
        logger.warning(f"No session data for student_id={student_id} month={month}")
        return None

    attendance_pct = round((attended / total_classes) * 100) if total_classes > 0 else 0

    # Build summaries — prefer session.summary (compact), fall back to transcript
    summaries = []
    for doc in attended_docs:
        text = str(doc.get("summary") or doc.get("transcript") or "").strip()
        if text:
            summaries.append(_summarise_transcript(text))

    return {
        "name": student_name or f"Student {student_id}",
        "grade": "",
        "teacher_name": teacher_name or "Unknown Teacher",
        "teacher_id": "",
        "subject": subject or "General",
        "month": month,
        "total_classes": total_classes,
        "attendance_pct": attendance_pct,
        "no_shows": no_shows,
        "summaries": summaries,
        "feedback": {},
    }


async def _mongo_list_students_for_teacher(teacher_name: str) -> list[dict]:
    from db.mongo import get_mongo_db
    db = get_mongo_db()
    sessions_col = db["sessions"]
    status_col = db["wise_status_sessions"]

    pipeline = [
        {
            "$match": {
                "teacher_name": teacher_name,
                "last_wise_event": "SessionTranscriptGeneratedEvent",
                "transcript": {"$nin": [None, ""]},
            }
        },
        {
            "$group": {
                "_id": "$student_id",
                "student_name": {"$first": "$student_name"},
                "last_session": {"$max": "$wise_event_received_at"},
                "session_count": {"$sum": 1},
            }
        },
        {"$match": {"_id": {"$nin": [None, ""]}}},
        {"$sort": {"student_name": 1}},
    ]

    grouped = [doc async for doc in sessions_col.aggregate(pipeline)]

    # Batch-fetch subjects for all students in one query (avoids N+1 round-trips
    # to status_col, which is what made teacher selection take ~30s on Render).
    names = sorted({
        (str(d.get("student_name") or "").strip())
        for d in grouped
        if str(d.get("student_name") or "").strip()
    })
    subject_by_name: dict[str, str] = {}
    if names:
        async for sd in status_col.find(
            {"studentName": {"$in": names}},
            {"studentName": 1, "subject": 1},
        ):
            sname = str(sd.get("studentName") or "").strip()
            if not sname or sname in subject_by_name:
                continue
            subject_by_name[sname] = _extract_subject_from_batch_code(
                str(sd.get("subject") or "")
            )

    students = []
    for doc in grouped:
        student_id = str(doc["_id"]).strip()
        student_name = str(doc.get("student_name") or "").strip()
        last_session = doc.get("last_session")
        students.append({
            "student_id": student_id,
            "student_name": student_name or f"Student {student_id}",
            "subject": subject_by_name.get(student_name) or "General",
            "session_count": doc.get("session_count", 0),
            "last_session": last_session.isoformat() if last_session else None,
        })

    return students


async def _mongo_get_student_sessions(student_id: str) -> list[dict]:
    from db.mongo import get_mongo_db
    db = get_mongo_db()
    sessions_col = db["sessions"]

    docs = await sessions_col.find(
        {
            "student_id": student_id,
            "last_wise_event": "SessionTranscriptGeneratedEvent",
            "transcript": {"$nin": [None, ""]},
        },
        {"wise_session_id": 1, "summary": 1, "transcript": 1, "wise_event_received_at": 1},
    ).sort("wise_event_received_at", -1).limit(20).to_list(None)
    docs = list(reversed(docs))

    sessions = []
    for doc in docs:
        text = str(doc.get("summary") or doc.get("transcript") or "").strip()
        date_val = doc.get("wise_event_received_at")
        sessions.append({
            "session_id": str(doc.get("wise_session_id") or doc.get("_id", "")),
            "date": date_val.strftime("%Y-%m-%d") if date_val else "",
            "topic_summary": text[:150],
            "transcript_excerpt": _summarise_transcript(text),
        })
    return sessions


async def _mongo_list_active_students(month: str) -> list[dict]:
    from db.mongo import get_mongo_db
    db = get_mongo_db()
    sessions_col = db["sessions"]
    status_col = db["wise_status_sessions"]

    start_dt, end_dt = _month_range(month)

    # Distinct students who had at least one session with a transcript this month
    pipeline = [
        {
            "$match": {
                "last_wise_event": "SessionTranscriptGeneratedEvent",
                "transcript": {"$nin": [None, ""]},
                "wise_event_received_at": {"$gte": start_dt, "$lte": end_dt},
            }
        },
        {
            "$group": {
                "_id": "$student_id",
                "student_name": {"$first": "$student_name"},
                "teacher_name": {"$first": "$teacher_name"},
            }
        },
        {"$match": {"_id": {"$nin": [None, ""]}}},
    ]

    cursor = sessions_col.aggregate(pipeline)
    students = []
    async for doc in cursor:
        student_id = str(doc["_id"]).strip()
        student_name = str(doc.get("student_name") or "").strip()
        teacher_name = str(doc.get("teacher_name") or "Unknown Teacher").strip()

        # Get subject from wise_status_sessions by student name
        subject = ""
        if student_name:
            status_doc = await status_col.find_one(
                {"studentName": student_name}, {"subject": 1}
            )
            if status_doc:
                subject = _extract_subject_from_batch_code(str(status_doc.get("subject") or ""))

        students.append(
            {
                "student_id": student_id,
                "name": student_name or f"Student {student_id}",
                "teacher_name": teacher_name,
                "teacher_id": "",
                "subject": subject or "General",
                "month": month,
            }
        )

    logger.info(f"list_active_students({month}): {len(students)} students from MongoDB")
    return students


# ── Mock fallback ─────────────────────────────────────────────────────────────

_MOCK_STUDENTS = {
    "stu-001": {"name": "Arjun Mehta", "grade": "Grade 8", "teacher_name": "Ms. Priya Sharma", "teacher_id": "tea-001", "subject": "Mathematics"},
    "stu-002": {"name": "Sneha Iyer", "grade": "Grade 7", "teacher_name": "Ms. Priya Sharma", "teacher_id": "tea-001", "subject": "English"},
    "stu-003": {"name": "Rohan Kapoor", "grade": "Grade 9", "teacher_name": "Ms. Priya Sharma", "teacher_id": "tea-001", "subject": "Coding"},
    "stu-004": {"name": "Meera Nair", "grade": "Grade 8", "teacher_name": "Ms. Priya Sharma", "teacher_id": "tea-001", "subject": "Mathematics"},
    "stu-005": {"name": "Dev Patel", "grade": "Grade 6", "teacher_name": "Mr. Anil Kumar", "teacher_id": "tea-002", "subject": "Chess"},
}

_MOCK_CLASS_DATA = {
    "stu-001": {
        "total_classes": 8, "attendance_pct": 87, "no_shows": 1,
        "summaries": [
            "Covered factoring of quadratic expressions. Arjun struggled initially but got it after a few examples.",
            "Completed the square method. Good participation today.",
            "Discussed discriminant and nature of roots. Student was attentive.",
            "Word problems with quadratics. Needs more practice with setting up equations.",
        ],
        "feedback": {},
    },
    "stu-002": {
        "total_classes": 8, "attendance_pct": 100, "no_shows": 0,
        "summaries": [
            "Descriptive writing with sensory details. Sneha produced excellent work.",
            "PEEL paragraph structure — student grasped it quickly and applied it well.",
            "Vocabulary in context exercises. Very strong performance.",
            "Reading comprehension strategies. Sneha asked great analytical questions.",
        ],
        "feedback": {"engagement": "Highly engaged", "concept": "Mastered the concept independently"},
    },
    "stu-003": {
        "total_classes": 8, "attendance_pct": 75, "no_shows": 2,
        "summaries": [
            "Python functions and scope — Rohan completed all exercises.",
            "Lists and list operations. Good understanding.",
            "For loops and while loops. Completed independently.",
            "Mini project: number guessing game. Rohan finished it on his own — great achievement.",
        ],
        "feedback": {},
    },
    "stu-004": {
        "total_classes": 8, "attendance_pct": 87, "no_shows": 1,
        "summaries": [
            "Geometry: lines and angles. Meera answered all questions correctly.",
            "Triangle properties — excellent grasp.",
            "Pythagoras theorem — solved problems independently.",
        ],
        "feedback": {"engagement": "Highly engaged", "concept": "Mastered the concept independently"},
    },
    "stu-005": {
        "total_classes": 4, "attendance_pct": 75, "no_shows": 1,
        "summaries": [
            "Opening principles — student showed interest.",
            "Tactics: pins and forks.",
        ],
        "feedback": {},
    },
}


# ── Public interface ──────────────────────────────────────────────────────────

async def get_student_month_data(student_id: str, month: str) -> dict | None:
    if os.getenv("MONGO_CONNECTION_STRING", "").strip():
        try:
            return await _mongo_get_student_month_data(student_id, month)
        except Exception as e:
            logger.error(f"MongoDB get_student_month_data failed, using mock: {e}")

    student = _MOCK_STUDENTS.get(student_id)
    if not student:
        return None
    return {**student, **_MOCK_CLASS_DATA.get(student_id, {}), "month": month}


async def list_all_teachers() -> list[dict]:
    if os.getenv("MONGO_CONNECTION_STRING", "").strip():
        try:
            from db.mongo import get_mongo_db
            db = get_mongo_db()
            names = await db["sessions"].distinct("teacher_name", {"teacher_name": {"$nin": [None, ""]}})
            return [{"teacher_name": n} for n in sorted(names) if n and n.strip()]
        except Exception as e:
            logger.error(f"MongoDB list_all_teachers failed, using mock: {e}")

    return [{"teacher_name": t} for t in sorted({s["teacher_name"] for s in _MOCK_STUDENTS.values()})]


async def list_students_for_teacher(teacher_name: str) -> list[dict]:
    if os.getenv("MONGO_CONNECTION_STRING", "").strip():
        try:
            return await _mongo_list_students_for_teacher(teacher_name)
        except Exception as e:
            logger.error(f"MongoDB list_students_for_teacher failed, using mock: {e}")

    return [
        {"student_id": sid, **_MOCK_STUDENTS[sid], "session_count": 4, "last_session": None}
        for sid in _MOCK_STUDENTS
        if _MOCK_STUDENTS[sid].get("teacher_name") == teacher_name
    ]


async def _mongo_get_student_email(student_id: str) -> str | None:
    """Best-effort student/parent email lookup from Wise data.

    The `student_id` we store on `ptm_reports` actually originates from
    `sessions.student_id`, which Wise uses as the **classroom** identifier
    (`wise_student_classrooms.wise_class_id`) — not as the student record id.
    So the primary lookup is by `wise_class_id`, with two fallbacks for
    safety when older data uses different shapes.
    """
    from db.mongo import get_mongo_db
    db = get_mongo_db()

    # Primary: wise_class_id match (correct path for everything that came in
    # via the sessions pipeline).
    sc = await db["wise_student_classrooms"].find_one(
        {"wise_class_id": student_id, "student_email": {"$nin": [None, ""]}},
        {"student_email": 1},
    )
    if sc and sc.get("student_email"):
        return str(sc["student_email"]).strip() or None

    # Fallback 1: maybe the id is actually a wise_student_id (different Wise
    # records use different shapes; cheap to try).
    sc = await db["wise_student_classrooms"].find_one(
        {"wise_student_id": student_id, "student_email": {"$nin": [None, ""]}},
        {"student_email": 1},
    )
    if sc and sc.get("student_email"):
        return str(sc["student_email"]).strip() or None

    # Fallback 2: wise_students keyed by ObjectId.
    try:
        from bson import ObjectId
        oid = ObjectId(student_id)
        s = await db["wise_students"].find_one({"_id": oid}, {"email": 1})
        if s and s.get("email"):
            return str(s["email"]).strip() or None
    except Exception:
        pass

    return None


async def get_student_email(student_id: str) -> str | None:
    if os.getenv("MONGO_CONNECTION_STRING", "").strip():
        try:
            return await _mongo_get_student_email(student_id)
        except Exception as e:
            logger.error(f"MongoDB get_student_email failed: {e}")
    return None


async def get_student_sessions(student_id: str) -> list[dict]:
    if os.getenv("MONGO_CONNECTION_STRING", "").strip():
        try:
            return await _mongo_get_student_sessions(student_id)
        except Exception as e:
            logger.error(f"MongoDB get_student_sessions failed, using mock: {e}")

    class_data = _MOCK_CLASS_DATA.get(student_id, {})
    return [
        {
            "session_id": f"{student_id}-mock-{i}",
            "date": f"2026-04-{5 + i * 7:02d}",
            "topic_summary": s[:120],
            "transcript_excerpt": s,
        }
        for i, s in enumerate(class_data.get("summaries", []))
    ]


async def list_active_students(month: str) -> list[dict]:
    if os.getenv("MONGO_CONNECTION_STRING", "").strip():
        try:
            return await _mongo_list_active_students(month)
        except Exception as e:
            logger.error(f"MongoDB list_active_students failed, using mock: {e}")

    return [{"student_id": sid, **_MOCK_STUDENTS[sid], "month": month} for sid in _MOCK_STUDENTS]
