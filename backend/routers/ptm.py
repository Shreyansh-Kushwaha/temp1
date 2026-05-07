import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.connection import get_db
from services import claude_service, wise_service

router = APIRouter(prefix="/api/ptm", tags=["ptm"])


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def row_to_report(row) -> dict:
    d = dict(row)
    d["draft_content"] = json.loads(d["draft_content"])
    return d


# ── Questions pool ──────────────────────────────────────────────────────────

ENGAGEMENT_OPTIONS = [
    {"value": 1, "label": "Highly engaged — asked questions and contributed actively"},
    {"value": 2, "label": "Engaged — participated when prompted"},
    {"value": 3, "label": "Moderately engaged — some focus drift"},
    {"value": 4, "label": "Needed encouragement to stay engaged"},
    {"value": 5, "label": "Distracted for most of the class"},
]
CONCEPT_OPTIONS = [
    {"value": 1, "label": "Mastered the concept independently"},
    {"value": 2, "label": "Understood with minimal guidance"},
    {"value": 3, "label": "Understood after multiple examples"},
    {"value": 4, "label": "Partially understood — needs revision"},
    {"value": 5, "label": "Needs significant reinforcement"},
]
APPLICATION_OPTIONS = [
    {"value": 1, "label": "Solved practice problems independently"},
    {"value": 2, "label": "Solved with light prompts"},
    {"value": 3, "label": "Solved with substantial support"},
    {"value": 4, "label": "Struggled with practice problems"},
    {"value": 5, "label": "Did not attempt practice work"},
]


def build_questions(inferred_fields: list[str], draft: dict) -> list[dict]:
    questions = []
    if "student_performance" in inferred_fields:
        questions.append({"type": "dropdown_engagement", "label": "How engaged was the student?", "options": ENGAGEMENT_OPTIONS})
        questions.append({"type": "dropdown_concept", "label": "How well did the student understand the concepts?", "options": CONCEPT_OPTIONS})
        questions.append({"type": "dropdown_application", "label": "How well did the student apply concepts in practice?", "options": APPLICATION_OPTIONS})
    if "learning_coverage" in inferred_fields:
        current = ", ".join(draft.get("learning_coverage", {}).get("topics", []))
        questions.append({"type": "topics_correction", "label": "What topics did the student actually cover?", "description": f"Agent inferred: {current}"})
    if "next_steps" in inferred_fields:
        current = ", ".join(draft.get("next_steps", {}).get("topics", []))
        questions.append({"type": "next_month_plan", "label": "What topics should the student focus on next month?", "description": f"Agent suggested: {current}"})
    questions.append({"type": "free_form", "label": "Anything else the agent got wrong or missed?", "description": "Optional."})
    return questions


# ── Pydantic models ─────────────────────────────────────────────────────────

class ApproveBody(BaseModel):
    teacher_note: str | None = None


class GenerateFromSessionsBody(BaseModel):
    student_id: str
    student_name: str
    teacher_name: str
    subject: str
    session_ids: list[str]
    engagement_level: str | None = None
    concept_understanding: str | None = None
    homework_effort: str | None = None
    specific_highlights: str | None = None
    improvement_areas: str | None = None
    parent_note: str | None = None
    next_month_goals: list[str] | None = None


class QuestionnaireBody(BaseModel):
    engagement_rating: int | None = None
    concept_rating: int | None = None
    application_rating: int | None = None
    topics_correction: str | None = None
    next_month_topics: list[str] | None = None
    free_form_note: str | None = None


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/students")
async def list_students_for_teacher(teacher_name: str):
    return await wise_service.list_students_for_teacher(teacher_name)


@router.get("/students/{student_id}/sessions")
async def get_student_sessions(student_id: str):
    return await wise_service.get_student_sessions(student_id)


@router.post("/reports/from-sessions")
async def generate_report_from_sessions(body: GenerateFromSessionsBody):
    from datetime import date as _date
    all_sessions = await wise_service.get_student_sessions(body.student_id)

    selected = [s for s in all_sessions if s["session_id"] in body.session_ids] if body.session_ids else all_sessions

    # Derive reporting period from the selected sessions' dates
    dates = [s["date"] for s in selected if s.get("date")]
    if dates:
        earliest, latest = min(dates), max(dates)
        reporting_period = f"{earliest} – {latest}"
        month = f"{earliest[:7]}-01"
    else:
        today = _date.today()
        month = f"{today.year}-{today.month:02d}-01"
        reporting_period = month

    wise_data = {
        "name": body.student_name,
        "grade": "",
        "teacher_name": body.teacher_name,
        "teacher_id": "",
        "subject": body.subject,
        "month": reporting_period,
        "total_classes": len(selected),
        "attendance_pct": 100,
        "no_shows": 0,
        "summaries": [s["transcript_excerpt"] for s in selected if s.get("transcript_excerpt")],
        "session_dates": dates,
        "feedback": {},
    }

    overrides: dict = {}
    if body.engagement_level:
        overrides["engagement"] = body.engagement_level
    if body.concept_understanding:
        overrides["concept_understanding"] = body.concept_understanding
    if body.homework_effort:
        overrides["homework_effort"] = body.homework_effort
    if body.specific_highlights:
        overrides["specific_highlights"] = body.specific_highlights
    if body.improvement_areas:
        overrides["improvement_areas"] = body.improvement_areas
    if body.parent_note:
        overrides["parent_note"] = body.parent_note
    if body.next_month_goals:
        overrides["next_month_topics"] = body.next_month_goals

    draft = await claude_service.generate_report(wise_data, overrides or None)

    db = await get_db()
    try:
        ts = now_iso()
        report_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO ptm_reports
               (id, student_id, teacher_id, student_name, subject, reporting_month,
                status, draft_content, regeneration_count, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)""",
            [report_id, body.student_id, "", body.student_name, body.subject,
             month, json.dumps(draft), ts, ts],
        )
        await db.commit()
        return {"report_id": report_id, "status": "pending", "draft_content": draft}
    finally:
        await db.close()


@router.get("/teachers")
async def list_teachers():
    return await wise_service.list_all_teachers()


@router.get("/reports")
async def list_reports(status: str | None = None, teacher_id: str | None = None, teacher_name: str | None = None):
    db = await get_db()
    try:
        clauses, params = ["deleted_at IS NULL"], []
        if status:
            clauses.append("status = ?")
            params.append(status)
        if teacher_id:
            clauses.append("teacher_id = ?")
            params.append(teacher_id)
        if teacher_name:
            clauses.append("json_extract(draft_content, '$.header.teacher_name') = ?")
            params.append(teacher_name)
        where = " AND ".join(clauses)
        async with db.execute(f"SELECT * FROM ptm_reports WHERE {where} ORDER BY created_at DESC", params) as cur:
            rows = await cur.fetchall()
        return [row_to_report(r) for r in rows]
    finally:
        await db.close()


@router.get("/reports/{report_id}")
async def get_report(report_id: str):
    db = await get_db()
    try:
        async with db.execute("SELECT * FROM ptm_reports WHERE id = ? AND deleted_at IS NULL", [report_id]) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        return row_to_report(row)
    finally:
        await db.close()


@router.post("/reports/{report_id}/approve")
async def approve_report(report_id: str, body: ApproveBody):
    db = await get_db()
    try:
        async with db.execute("SELECT * FROM ptm_reports WHERE id = ? AND deleted_at IS NULL", [report_id]) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        if dict(row)["status"] not in ("pending", "rejected"):
            raise HTTPException(status_code=400, detail="Report is not pending")

        ts = now_iso()
        await db.execute(
            "UPDATE ptm_reports SET status='approved', teacher_note=?, updated_at=? WHERE id=?",
            [body.teacher_note, ts, report_id],
        )
        # Mock delivery log entries
        for channel in ("email", "whatsapp"):
            await db.execute(
                "INSERT INTO ptm_delivery_log (id, report_id, channel, status, sent_at) VALUES (?, ?, ?, 'sent', ?)",
                [str(uuid.uuid4()), report_id, channel, ts],
            )
        await db.commit()
        return {"status": "approved", "delivered_via": ["email", "whatsapp"]}
    finally:
        await db.close()


@router.post("/reports/{report_id}/reject")
async def reject_report(report_id: str):
    db = await get_db()
    try:
        async with db.execute("SELECT * FROM ptm_reports WHERE id = ? AND deleted_at IS NULL", [report_id]) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")

        ts = now_iso()
        await db.execute("UPDATE ptm_reports SET status='rejected', updated_at=? WHERE id=?", [ts, report_id])
        await db.commit()

        report = row_to_report(row)
        draft = report["draft_content"]
        inferred = draft.get("_inferred_fields", [])
        questions = build_questions(inferred, draft)
        return {"status": "rejected", "questions": questions}
    finally:
        await db.close()


@router.get("/reports/{report_id}/questionnaire")
async def get_questionnaire(report_id: str):
    db = await get_db()
    try:
        async with db.execute("SELECT * FROM ptm_reports WHERE id = ? AND deleted_at IS NULL", [report_id]) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        report = row_to_report(row)
        draft = report["draft_content"]
        inferred = draft.get("_inferred_fields", [])
        return {"questions": build_questions(inferred, draft)}
    finally:
        await db.close()


@router.post("/reports/{report_id}/questionnaire")
async def submit_questionnaire(report_id: str, body: QuestionnaireBody):
    db = await get_db()
    try:
        async with db.execute("SELECT * FROM ptm_reports WHERE id = ? AND deleted_at IS NULL", [report_id]) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        report = row_to_report(row)

        regen_count = report["regeneration_count"] + 1
        ts = now_iso()

        # Save questionnaire response
        await db.execute(
            """INSERT INTO ptm_questionnaire_responses
               (id, report_id, engagement_rating, concept_rating, application_rating,
                topics_correction, next_month_topics, free_form_note, submitted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                str(uuid.uuid4()), report_id,
                body.engagement_rating, body.concept_rating, body.application_rating,
                body.topics_correction,
                json.dumps(body.next_month_topics) if body.next_month_topics else None,
                body.free_form_note, ts,
            ],
        )

        if regen_count >= 2:
            await db.execute(
                "UPDATE ptm_reports SET status='escalated', regeneration_count=?, updated_at=? WHERE id=?",
                [regen_count, ts, report_id],
            )
            await db.commit()
            return {"status": "escalated", "message": "Reached 2 regeneration cycles — escalated to manager."}

        # Build overrides dict from answers
        overrides = {}
        engagement_labels = {o["value"]: o["label"] for o in ENGAGEMENT_OPTIONS}
        concept_labels = {o["value"]: o["label"] for o in CONCEPT_OPTIONS}
        application_labels = {o["value"]: o["label"] for o in APPLICATION_OPTIONS}

        if body.engagement_rating:
            overrides["engagement"] = engagement_labels.get(body.engagement_rating, "")
        if body.concept_rating:
            overrides["concept_understanding"] = concept_labels.get(body.concept_rating, "")
        if body.application_rating:
            overrides["application"] = application_labels.get(body.application_rating, "")
        if body.topics_correction:
            overrides["topics_correction"] = body.topics_correction
        if body.next_month_topics:
            overrides["next_month_topics"] = body.next_month_topics
        if body.free_form_note:
            overrides["free_form_note"] = body.free_form_note

        # Get Wise data for regeneration
        wise_data = await wise_service.get_student_month_data(
            report["student_id"], report["reporting_month"]
        )
        if not wise_data:
            raise HTTPException(status_code=500, detail="Could not fetch student data")

        new_draft = await claude_service.generate_report(wise_data, overrides)

        await db.execute(
            "UPDATE ptm_reports SET draft_content=?, status='pending', regeneration_count=?, updated_at=? WHERE id=?",
            [json.dumps(new_draft), regen_count, ts, report_id],
        )
        await db.commit()
        return {"status": "regenerated", "draft_content": new_draft, "regeneration_count": regen_count}
    finally:
        await db.close()


@router.post("/generate")
async def generate_all_reports(month: str | None = None):
    from datetime import date
    if not month:
        today = date.today()
        month = f"{today.year}-{today.month:02d}-01"

    students = await wise_service.list_active_students(month)
    db = await get_db()
    created = []
    skipped = []
    try:
        for s in students:
            # Skip if report already exists for this student + month
            async with db.execute(
                "SELECT id FROM ptm_reports WHERE student_id=? AND reporting_month=? AND deleted_at IS NULL",
                [s["student_id"], month],
            ) as cur:
                existing = await cur.fetchone()
            if existing:
                skipped.append(s["student_id"])
                continue

            wise_data = await wise_service.get_student_month_data(s["student_id"], month)
            draft = await claude_service.generate_report(wise_data)

            ts = now_iso()
            report_id = str(uuid.uuid4())
            await db.execute(
                """INSERT INTO ptm_reports
                   (id, student_id, teacher_id, student_name, subject, reporting_month,
                    status, draft_content, regeneration_count, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)""",
                [report_id, s["student_id"], s["teacher_id"], s["name"], s["subject"],
                 month, json.dumps(draft), ts, ts],
            )
            created.append(report_id)

        await db.commit()
        return {"created": len(created), "skipped": len(skipped), "report_ids": created}
    finally:
        await db.close()


@router.get("/escalated")
async def list_escalated():
    db = await get_db()
    try:
        async with db.execute(
            "SELECT * FROM ptm_reports WHERE status='escalated' AND deleted_at IS NULL ORDER BY updated_at DESC"
        ) as cur:
            rows = await cur.fetchall()
        return [row_to_report(r) for r in rows]
    finally:
        await db.close()


@router.post("/escalated/{report_id}/override")
async def override_escalated(report_id: str):
    db = await get_db()
    try:
        async with db.execute("SELECT id FROM ptm_reports WHERE id=? AND status='escalated' AND deleted_at IS NULL", [report_id]) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Escalated report not found")

        ts = now_iso()
        await db.execute("UPDATE ptm_reports SET status='approved', updated_at=? WHERE id=?", [ts, report_id])
        for channel in ("email", "whatsapp"):
            await db.execute(
                "INSERT INTO ptm_delivery_log (id, report_id, channel, status, sent_at) VALUES (?, ?, ?, 'sent', ?)",
                [str(uuid.uuid4()), report_id, channel, ts],
            )
        await db.commit()
        return {"status": "approved", "delivered_via": ["email", "whatsapp"]}
    finally:
        await db.close()
