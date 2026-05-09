import json
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger("ptm.router")

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from db.connection import get_db
from services import claude_service, pdf_service, wise_service, tts_service, risk_service, version_service

router = APIRouter(prefix="/api/ptm", tags=["ptm"])


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def row_to_report(row) -> dict:
    d = dict(row)
    d["draft_content"] = json.loads(d["draft_content"])
    # Tone defaults so older rows don't break clients
    d.setdefault("tone_warmth", "balanced")
    d.setdefault("tone_detail", "balanced")
    if d.get("tone_warmth") is None:
        d["tone_warmth"] = "balanced"
    if d.get("tone_detail") is None:
        d["tone_detail"] = "balanced"
    return d


def _extract_overall_confidence(draft: dict) -> int | None:
    ai = draft.get("ai_confidence") or {}
    val = ai.get("overall")
    return int(val) if isinstance(val, (int, float)) else None


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


class PatchDraftBody(BaseModel):
    draft_content: dict


class ToneBody(BaseModel):
    warmth: str | None = None  # warm | balanced | formal
    detail: str | None = None  # concise | balanced | detailed


def _tone_dict(tone: ToneBody | None) -> dict | None:
    if not tone:
        return None
    out = {}
    if tone.warmth in ("warm", "balanced", "formal"):
        out["warmth"] = tone.warmth
    if tone.detail in ("concise", "balanced", "detailed"):
        out["detail"] = tone.detail
    return out or None


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
    tone: ToneBody | None = None


class QuestionnaireBody(BaseModel):
    engagement_rating: int | None = None
    concept_rating: int | None = None
    application_rating: int | None = None
    topics_correction: str | None = None
    next_month_topics: list[str] | None = None
    free_form_note: str | None = None
    tone: ToneBody | None = None


class RegenerateWithToneBody(BaseModel):
    tone: ToneBody


class AudioSummaryBody(BaseModel):
    voice: str | None = None


class CopilotMessageBody(BaseModel):
    student_id: str
    conversation_id: str | None = None
    message: str


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/students")
async def list_students_for_teacher(teacher_name: str):
    return await wise_service.list_students_for_teacher(teacher_name)


@router.get("/students/{student_id}/sessions")
async def get_student_sessions(student_id: str):
    return await wise_service.get_student_sessions(student_id)


@router.post("/reports/from-sessions")
async def generate_report_from_sessions(body: GenerateFromSessionsBody, background_tasks: BackgroundTasks):
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

    tone = _tone_dict(body.tone)
    draft = await claude_service.generate_report(wise_data, overrides or None, tone)
    overall = _extract_overall_confidence(draft)

    db = await get_db()
    try:
        ts = now_iso()
        report_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO ptm_reports
               (id, student_id, teacher_id, student_name, subject, reporting_month,
                status, draft_content, regeneration_count, created_at, updated_at,
                overall_confidence, tone_warmth, tone_detail)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?, ?, ?, ?)""",
            [report_id, body.student_id, "", body.student_name, body.subject,
             month, json.dumps(draft), ts, ts, overall,
             (tone or {}).get("warmth", "balanced"), (tone or {}).get("detail", "balanced")],
        )
        # Initial version snapshot
        await db.execute(
            """INSERT INTO ptm_report_versions
               (id, report_id, version_number, draft_content, trigger, created_at)
               VALUES (?, ?, 1, ?, 'initial', ?)""",
            [str(uuid.uuid4()), report_id, json.dumps(draft), ts],
        )
        await db.commit()
        background_tasks.add_task(pdf_service.generate_and_store_pdf, report_id, 1)
        return {"report_id": report_id, "status": "pending", "draft_content": draft}
    finally:
        await db.close()


@router.get("/teachers")
async def list_teachers():
    return await wise_service.list_all_teachers()


# ─────────────────────────────────────────────────────────────────────────────
# Auto-generate opt-in (per teacher) + n8n daily batch endpoint
# ─────────────────────────────────────────────────────────────────────────────

class AutoGenerateToggleBody(BaseModel):
    teacher_name: str
    enabled: bool


@router.get("/teachers/auto-generate")
async def list_teachers_auto_generate():
    """List every teacher with their auto-generate flag (defaults to false
    when no settings row exists yet). Used by the /ptm/automation UI."""
    teachers = await wise_service.list_all_teachers()
    db = await get_db()
    try:
        async with db.execute(
            "SELECT teacher_name, auto_generate_enabled FROM ptm_teacher_settings"
        ) as cur:
            rows = await cur.fetchall()
        settings = {r["teacher_name"]: bool(r["auto_generate_enabled"]) for r in rows}
        return [
            {
                "teacher_name": t["teacher_name"],
                "auto_generate_enabled": settings.get(t["teacher_name"], False),
            }
            for t in teachers
        ]
    finally:
        await db.close()


@router.patch("/teachers/auto-generate")
async def set_teacher_auto_generate(body: AutoGenerateToggleBody):
    """Toggle a teacher's opt-in for the daily auto-generate job."""
    ts = now_iso()
    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO ptm_teacher_settings (teacher_name, auto_generate_enabled, updated_at)
               VALUES (?, ?, ?)
               ON CONFLICT(teacher_name) DO UPDATE SET
                 auto_generate_enabled=excluded.auto_generate_enabled,
                 updated_at=excluded.updated_at""",
            [body.teacher_name, body.enabled, ts],
        )
        await db.commit()
        return {"teacher_name": body.teacher_name, "auto_generate_enabled": body.enabled}
    finally:
        await db.close()


@router.post("/auto-generate/run")
async def auto_generate_run(
    background_tasks: BackgroundTasks,
    month: str | None = None,
    batch_size: int = 20,
):
    """Daily auto-generate for opted-in teachers.

    Decision order (durability first):
      1. Does this student already have a report for `month`?  → skip ("existing")
      2. Is this student's teacher opted in?                     → skip ("no_optin")
      3. Otherwise, generate with default answers and queue PDF render.

    A unique partial index on ptm_reports(student_id, reporting_month)
    WHERE deleted_at IS NULL guarantees that even if two runs overlap, only
    one INSERT survives — the duplicate hits IntegrityError which we catch
    and bucket as "existing".
    """
    import sqlite3
    from datetime import date

    if not month:
        today = date.today()
        month = f"{today.year}-{today.month:02d}-01"
    batch_size = max(1, min(100, batch_size))

    db = await get_db()
    try:
        # Pre-fetch the opt-in set ONCE for the whole run.
        async with db.execute(
            "SELECT teacher_name FROM ptm_teacher_settings WHERE auto_generate_enabled = TRUE"
        ) as cur:
            opted_in = {r["teacher_name"] for r in await cur.fetchall()}
        logger.info("auto_generate: %d teacher(s) opted in for month=%s", len(opted_in), month)

        all_active = await wise_service.list_active_students(month)
        logger.info("auto_generate: %d active students this month", len(all_active))

        skipped_existing: list[str] = []
        skipped_no_optin: list[str] = []
        pending: list[dict] = []

        # ── Per-student gate (in the order the user asked for): ──
        for s in all_active:
            sid = s["student_id"]

            # GATE 1: report already exists for this student+month?  durable check
            async with db.execute(
                "SELECT id FROM ptm_reports WHERE student_id=? AND reporting_month=? AND deleted_at IS NULL",
                [sid, month],
            ) as cur:
                existing = await cur.fetchone()
            if existing:
                skipped_existing.append(sid)
                continue

            # GATE 2: teacher opt-in
            if s.get("teacher_name") not in opted_in:
                skipped_no_optin.append(sid)
                continue

            # Both gates passed → eligible to generate
            pending.append(s)

        to_process = pending[:batch_size]
        remaining = max(0, len(pending) - batch_size)
        logger.info(
            "auto_generate: gates → %d existing, %d no-optin, %d eligible (processing %d, remaining %d)",
            len(skipped_existing), len(skipped_no_optin), len(pending), len(to_process), remaining,
        )

        processed: list[dict] = []
        for s in to_process:
            sid = s["student_id"]
            wise_data = await wise_service.get_student_month_data(sid, month)
            if not wise_data:
                logger.warning("auto_generate: skipping %s — wise_service returned no data", sid)
                continue

            # Default answers = no overrides, balanced tone (AI-generated draft).
            draft = await claude_service.generate_report(wise_data)
            overall = _extract_overall_confidence(draft)
            ts = now_iso()
            report_id = str(uuid.uuid4())

            try:
                await db.execute(
                    """INSERT INTO ptm_reports
                       (id, student_id, teacher_id, student_name, subject, reporting_month,
                        status, draft_content, regeneration_count, created_at, updated_at,
                        overall_confidence, tone_warmth, tone_detail)
                       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?, ?, 'balanced', 'balanced')""",
                    [report_id, sid, s.get("teacher_id", ""), s["name"], s["subject"],
                     month, json.dumps(draft), ts, ts, overall],
                )
            except sqlite3.IntegrityError as e:
                # Unique-index race: another process beat us to it.
                logger.info("auto_generate: race-skip for %s (%s) — %s", sid, month, e)
                skipped_existing.append(sid)
                continue

            await db.execute(
                """INSERT INTO ptm_report_versions
                   (id, report_id, version_number, draft_content, trigger, created_at)
                   VALUES (?, ?, 1, ?, 'auto_generate', ?)""",
                [str(uuid.uuid4()), report_id, json.dumps(draft), ts],
            )
            processed.append({
                "report_id": report_id,
                "student_id": sid,
                "student_name": s["name"],
                "teacher_name": s.get("teacher_name"),
            })

        await db.commit()

        for p in processed:
            background_tasks.add_task(pdf_service.generate_and_store_pdf, p["report_id"], 1)

        note = None
        if not opted_in:
            note = "No teachers have auto-generate enabled — every student fell through gate 2."

        return {
            "month": month,
            "batch_size": batch_size,
            "processed": processed,
            "skipped_existing": skipped_existing,
            "skipped_no_optin": skipped_no_optin,
            "remaining": remaining,
            "note": note,
        }
    finally:
        await db.close()


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
            # Postgres JSONB path query — draft_content is stored as TEXT, cast at read time
            clauses.append("(draft_content::jsonb)->'header'->>'teacher_name' = ?")
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


@router.patch("/reports/{report_id}")
async def patch_report(report_id: str, body: PatchDraftBody, background_tasks: BackgroundTasks):
    db = await get_db()
    try:
        async with db.execute("SELECT id FROM ptm_reports WHERE id = ? AND deleted_at IS NULL", [report_id]) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        ts = now_iso()
        overall = _extract_overall_confidence(body.draft_content)
        await db.execute(
            "UPDATE ptm_reports SET draft_content=?, overall_confidence=?, updated_at=? WHERE id=?",
            [json.dumps(body.draft_content), overall, ts, report_id],
        )
        # Snapshot post-edit version
        async with db.execute(
            "SELECT COALESCE(MAX(version_number),0) FROM ptm_report_versions WHERE report_id=?",
            [report_id],
        ) as cur:
            (max_v,) = await cur.fetchone()
        new_version = int(max_v) + 1
        await db.execute(
            """INSERT INTO ptm_report_versions
               (id, report_id, version_number, draft_content, trigger, created_at)
               VALUES (?, ?, ?, ?, 'edit', ?)""",
            [str(uuid.uuid4()), report_id, new_version, json.dumps(body.draft_content), ts],
        )
        await db.commit()
        background_tasks.add_task(pdf_service.generate_and_store_pdf, report_id, new_version)
        return {"status": "saved"}
    finally:
        await db.close()


@router.post("/reports/{report_id}/approve")
async def approve_report(report_id: str, body: ApproveBody, background_tasks: BackgroundTasks):
    db = await get_db()
    try:
        async with db.execute("SELECT * FROM ptm_reports WHERE id = ? AND deleted_at IS NULL", [report_id]) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        report = row_to_report(row)
        if report["status"] not in ("pending", "rejected"):
            raise HTTPException(status_code=400, detail="Report is not pending")

        ts = now_iso()
        await db.execute(
            "UPDATE ptm_reports SET status='approved', teacher_note=?, updated_at=? WHERE id=?",
            [body.teacher_note, ts, report_id],
        )
        # Snapshot the approved state as a new version so the rendered PDF is
        # the definitive "what was sent to parents" record.
        async with db.execute(
            "SELECT COALESCE(MAX(version_number),0) FROM ptm_report_versions WHERE report_id=?",
            [report_id],
        ) as cur:
            (max_v,) = await cur.fetchone()
        approved_version = int(max_v) + 1
        await db.execute(
            """INSERT INTO ptm_report_versions
               (id, report_id, version_number, draft_content, trigger, notes, created_at)
               VALUES (?, ?, ?, ?, 'approved', ?, ?)""",
            [str(uuid.uuid4()), report_id, approved_version,
             json.dumps(report["draft_content"]), body.teacher_note, ts],
        )
        # Mock delivery log entries
        for channel in ("email", "whatsapp"):
            await db.execute(
                "INSERT INTO ptm_delivery_log (id, report_id, channel, status, sent_at) VALUES (?, ?, ?, 'sent', ?)",
                [str(uuid.uuid4()), report_id, channel, ts],
            )
        await db.commit()
        background_tasks.add_task(pdf_service.generate_and_store_pdf, report_id, approved_version)
        return {"status": "approved", "delivered_via": ["email", "whatsapp"]}
    finally:
        await db.close()


@router.delete("/reports/{report_id}")
async def delete_report(report_id: str):
    db = await get_db()
    try:
        async with db.execute("SELECT id FROM ptm_reports WHERE id = ? AND deleted_at IS NULL", [report_id]) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        ts = now_iso()
        await db.execute("UPDATE ptm_reports SET deleted_at=? WHERE id=?", [ts, report_id])
        await db.commit()
        return {"status": "deleted"}
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
async def submit_questionnaire(report_id: str, body: QuestionnaireBody, background_tasks: BackgroundTasks):
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

        # Tone — body wins, else carry over the report's stored tone
        tone = _tone_dict(body.tone) or {
            "warmth": report.get("tone_warmth") or "balanced",
            "detail": report.get("tone_detail") or "balanced",
        }

        new_draft = await claude_service.generate_report(wise_data, overrides, tone)
        overall = _extract_overall_confidence(new_draft)

        await db.execute(
            """UPDATE ptm_reports
               SET draft_content=?, status='pending', regeneration_count=?, updated_at=?,
                   overall_confidence=?, tone_warmth=?, tone_detail=?
               WHERE id=?""",
            [json.dumps(new_draft), regen_count, ts, overall,
             tone.get("warmth", "balanced"), tone.get("detail", "balanced"), report_id],
        )
        async with db.execute(
            "SELECT COALESCE(MAX(version_number),0) FROM ptm_report_versions WHERE report_id=?",
            [report_id],
        ) as cur:
            (max_v,) = await cur.fetchone()
        new_version = int(max_v) + 1
        await db.execute(
            """INSERT INTO ptm_report_versions
               (id, report_id, version_number, draft_content, trigger, notes, created_at)
               VALUES (?, ?, ?, ?, 'regenerate', ?, ?)""",
            [str(uuid.uuid4()), report_id, new_version, json.dumps(new_draft),
             body.free_form_note, ts],
        )
        await db.commit()
        background_tasks.add_task(pdf_service.generate_and_store_pdf, report_id, new_version)
        return {"status": "regenerated", "draft_content": new_draft, "regeneration_count": regen_count}
    finally:
        await db.close()


@router.post("/reports/{report_id}/regenerate-tone")
async def regenerate_with_tone(report_id: str, body: RegenerateWithToneBody, background_tasks: BackgroundTasks):
    """Re-render an existing report with new tone settings. Doesn't count toward the 2-cycle rejection cap."""
    db = await get_db()
    try:
        async with db.execute(
            "SELECT * FROM ptm_reports WHERE id = ? AND deleted_at IS NULL", [report_id]
        ) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        report = row_to_report(row)

        tone = _tone_dict(body.tone) or {"warmth": "balanced", "detail": "balanced"}
        wise_data = await wise_service.get_student_month_data(
            report["student_id"], report["reporting_month"]
        )
        if not wise_data:
            raise HTTPException(status_code=500, detail="Could not fetch student data")

        new_draft = await claude_service.generate_report(wise_data, None, tone)
        overall = _extract_overall_confidence(new_draft)
        ts = now_iso()

        await db.execute(
            """UPDATE ptm_reports
               SET draft_content=?, overall_confidence=?, tone_warmth=?, tone_detail=?, updated_at=?
               WHERE id=?""",
            [json.dumps(new_draft), overall,
             tone.get("warmth", "balanced"), tone.get("detail", "balanced"), ts, report_id],
        )
        async with db.execute(
            "SELECT COALESCE(MAX(version_number),0) FROM ptm_report_versions WHERE report_id=?",
            [report_id],
        ) as cur:
            (max_v,) = await cur.fetchone()
        new_version = int(max_v) + 1
        await db.execute(
            """INSERT INTO ptm_report_versions
               (id, report_id, version_number, draft_content, trigger, created_at)
               VALUES (?, ?, ?, ?, 'tone_change', ?)""",
            [str(uuid.uuid4()), report_id, new_version, json.dumps(new_draft), ts],
        )
        await db.commit()
        background_tasks.add_task(pdf_service.generate_and_store_pdf, report_id, new_version)
        return {"status": "regenerated", "draft_content": new_draft, "tone": tone}
    finally:
        await db.close()


@router.post("/generate")
async def generate_all_reports(background_tasks: BackgroundTasks, month: str | None = None):
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
            overall = _extract_overall_confidence(draft)

            ts = now_iso()
            report_id = str(uuid.uuid4())
            await db.execute(
                """INSERT INTO ptm_reports
                   (id, student_id, teacher_id, student_name, subject, reporting_month,
                    status, draft_content, regeneration_count, created_at, updated_at,
                    overall_confidence, tone_warmth, tone_detail)
                   VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?, ?, 'balanced', 'balanced')""",
                [report_id, s["student_id"], s["teacher_id"], s["name"], s["subject"],
                 month, json.dumps(draft), ts, ts, overall],
            )
            await db.execute(
                """INSERT INTO ptm_report_versions
                   (id, report_id, version_number, draft_content, trigger, created_at)
                   VALUES (?, ?, 1, ?, 'initial', ?)""",
                [str(uuid.uuid4()), report_id, json.dumps(draft), ts],
            )
            created.append(report_id)

        await db.commit()
        for rid in created:
            background_tasks.add_task(pdf_service.generate_and_store_pdf, rid, 1)
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
async def override_escalated(report_id: str, background_tasks: BackgroundTasks):
    db = await get_db()
    try:
        async with db.execute("SELECT * FROM ptm_reports WHERE id=? AND status='escalated' AND deleted_at IS NULL", [report_id]) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Escalated report not found")
        report = row_to_report(row)

        ts = now_iso()
        await db.execute("UPDATE ptm_reports SET status='approved', updated_at=? WHERE id=?", [ts, report_id])
        async with db.execute(
            "SELECT COALESCE(MAX(version_number),0) FROM ptm_report_versions WHERE report_id=?",
            [report_id],
        ) as cur:
            (max_v,) = await cur.fetchone()
        approved_version = int(max_v) + 1
        await db.execute(
            """INSERT INTO ptm_report_versions
               (id, report_id, version_number, draft_content, trigger, created_at)
               VALUES (?, ?, ?, ?, 'manager_override', ?)""",
            [str(uuid.uuid4()), report_id, approved_version,
             json.dumps(report["draft_content"]), ts],
        )
        for channel in ("email", "whatsapp"):
            await db.execute(
                "INSERT INTO ptm_delivery_log (id, report_id, channel, status, sent_at) VALUES (?, ?, ?, 'sent', ?)",
                [str(uuid.uuid4()), report_id, channel, ts],
            )
        await db.commit()
        background_tasks.add_task(pdf_service.generate_and_store_pdf, report_id, approved_version)
        return {"status": "approved", "delivered_via": ["email", "whatsapp"]}
    finally:
        await db.close()


# ─────────────────────────────────────────────────────────────────────────────
# On-demand PDF render — returns a public Supabase URL the frontend can download
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/reports/{report_id}/pdf")
async def render_pdf_now(report_id: str):
    """Synchronously render the report's print page to PDF via Playwright,
    upload to Supabase Storage, persist the URL on ptm_reports.pdf_url, and
    return it. Frontend uses this for a one-click 'Download PDF' flow."""
    db = await get_db()
    try:
        async with db.execute(
            "SELECT id FROM ptm_reports WHERE id = ? AND deleted_at IS NULL", [report_id]
        ) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")

        async with db.execute(
            "SELECT COALESCE(MAX(version_number),1) FROM ptm_report_versions WHERE report_id=?",
            [report_id],
        ) as cur:
            (version,) = await cur.fetchone()
    finally:
        await db.close()

    pdf_url = await pdf_service.generate_and_store_pdf(report_id, int(version))
    if not pdf_url:
        raise HTTPException(
            status_code=500,
            detail="PDF generation failed. Check that Playwright Chromium is installed and the frontend is reachable from the backend.",
        )
    return {"pdf_url": pdf_url, "version_number": int(version)}


# ─────────────────────────────────────────────────────────────────────────────
# Phase 2: audio summary
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/reports/{report_id}/audio-summary")
async def create_audio_summary(report_id: str, body: AudioSummaryBody):
    db = await get_db()
    try:
        async with db.execute(
            "SELECT * FROM ptm_reports WHERE id = ? AND deleted_at IS NULL", [report_id]
        ) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        report = row_to_report(row)
        script = report["draft_content"].get("audio_script") or ""
        if not script:
            raise HTTPException(status_code=400, detail="No audio_script available — regenerate the report first")

        result = await tts_service.synthesize_summary(script, voice=body.voice)
        ts = now_iso()
        audio_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO ptm_audio_summaries
               (id, report_id, provider, voice, script, audio_url,
                duration_seconds, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?)""",
            [audio_id, report_id, result.provider, result.voice, result.script,
             result.audio_url, result.duration_seconds, ts],
        )
        if result.audio_url:
            await db.execute(
                "UPDATE ptm_reports SET audio_url=?, updated_at=? WHERE id=?",
                [result.audio_url, ts, report_id],
            )
        await db.commit()
        return {
            "id": audio_id,
            "provider": result.provider,
            "script": result.script,
            "audio_url": result.audio_url,
            "duration_seconds": result.duration_seconds,
            "voice": result.voice,
        }
    finally:
        await db.close()


@router.get("/reports/{report_id}/audio-summary")
async def get_audio_summary(report_id: str):
    db = await get_db()
    try:
        async with db.execute(
            """SELECT * FROM ptm_audio_summaries
               WHERE report_id = ? ORDER BY created_at DESC LIMIT 1""",
            [report_id],
        ) as cur:
            row = await cur.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        await db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Phase 2: version history (powers diff view)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/reports/{report_id}/versions")
async def list_report_versions(report_id: str):
    db = await get_db()
    try:
        return await version_service.list_versions(db, report_id)
    finally:
        await db.close()


@router.get("/reports/{report_id}/versions/{version_number}")
async def get_report_version(report_id: str, version_number: int):
    db = await get_db()
    try:
        v = await version_service.get_version(db, report_id, version_number)
        if not v:
            raise HTTPException(status_code=404, detail="Version not found")
        return v
    finally:
        await db.close()


@router.get("/reports/{report_id}/diff")
async def get_report_diff(report_id: str, before: int | None = None, after: int | None = None):
    db = await get_db()
    try:
        a, b = await version_service.get_pair(db, report_id, before, after)
        if not b:
            raise HTTPException(status_code=404, detail="No versions to diff")
        return {"before": a, "after": b}
    finally:
        await db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Phase 2: risk detection
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/risk/recompute")
async def recompute_all_risk():
    """Walk every student's history and rebuild ptm_risk_signals."""
    db = await get_db()
    try:
        async with db.execute(
            """SELECT student_id FROM ptm_reports
               WHERE deleted_at IS NULL
               GROUP BY student_id"""
        ) as cur:
            student_ids = [r[0] for r in await cur.fetchall()]
        total = 0
        for sid in student_ids:
            async with db.execute(
                """SELECT * FROM ptm_reports
                   WHERE student_id = ? AND deleted_at IS NULL
                   ORDER BY reporting_month ASC, created_at ASC""",
                [sid],
            ) as cur:
                rows = [dict(r) for r in await cur.fetchall()]
            for r in rows:
                try:
                    r["draft_content"] = json.loads(r["draft_content"])
                except (json.JSONDecodeError, TypeError):
                    r["draft_content"] = {}
            signals = risk_service.detect_for_history(sid, rows)
            await risk_service.replace_signals_for_student(db, sid, signals)
            total += len(signals)
        await db.commit()
        return {"students_checked": len(student_ids), "active_signals": total}
    finally:
        await db.close()


@router.get("/risk/students-at-risk")
async def list_students_at_risk(severity: str | None = None):
    db = await get_db()
    try:
        signals = await risk_service.list_active_signals(db, severity=severity)
        # Group by student
        grouped: dict[str, dict] = {}
        for s in signals:
            sid = s["student_id"]
            entry = grouped.setdefault(sid, {
                "student_id": sid,
                "highest_severity": "low",
                "signals": [],
                "student_name": None,
                "subject": None,
            })
            entry["signals"].append(s)
            if risk_service.SEVERITY_RANK[s["severity"]] > risk_service.SEVERITY_RANK[entry["highest_severity"]]:
                entry["highest_severity"] = s["severity"]
        # Hydrate student name + subject from the most recent report
        for sid, entry in grouped.items():
            async with db.execute(
                """SELECT student_name, subject FROM ptm_reports
                   WHERE student_id = ? AND deleted_at IS NULL
                   ORDER BY created_at DESC LIMIT 1""",
                [sid],
            ) as cur:
                row = await cur.fetchone()
            if row:
                entry["student_name"] = row[0]
                entry["subject"] = row[1]
        # Sort by severity (high first), then name
        ordered = sorted(
            grouped.values(),
            key=lambda e: (-risk_service.SEVERITY_RANK[e["highest_severity"]], e["student_name"] or ""),
        )
        return ordered
    finally:
        await db.close()


@router.get("/risk/students/{student_id}")
async def get_student_risk(student_id: str):
    db = await get_db()
    try:
        async with db.execute(
            """SELECT * FROM ptm_risk_signals
               WHERE student_id = ?
               ORDER BY created_at DESC""",
            [student_id],
        ) as cur:
            rows = await cur.fetchall()
        out = []
        for r in rows:
            d = dict(r)
            try:
                d["evidence"] = json.loads(d["evidence"]) if d.get("evidence") else []
            except json.JSONDecodeError:
                d["evidence"] = []
            out.append(d)
        return out
    finally:
        await db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3: copilot (hardcoded for now — architecture supports real LLM later)
# ─────────────────────────────────────────────────────────────────────────────

_COPILOT_INTENTS = [
    ("changed", "What changed this month"),
    ("weak", "Weak areas"),
    ("summarize", "Summary of progress"),
    ("parents help", "Parent guidance"),
    ("confidence drop", "Confidence drop"),
]


def _copilot_canned_response(student_id: str, message: str, latest_report: dict | None) -> str:
    msg = message.lower()
    name = (latest_report or {}).get("student_name") or "the student"
    d = (latest_report or {}).get("draft_content") or {}

    if any(t in msg for t in ["changed", "what changed", "this month"]):
        topics = d.get("learning_coverage", {}).get("topics", []) or []
        nxt = d.get("next_steps", {}).get("topics", []) or []
        return (
            f"This month {name} covered: {', '.join(topics[:3]) or 'core concepts'}. "
            f"Compared with prior reports, the most notable shifts were in engagement and "
            f"independent application. The recommended next steps are "
            f"{', '.join(nxt[:2]) or 'continued practice'}."
        )
    if any(t in msg for t in ["weak", "growth", "struggle"]):
        items = d.get("growth_areas", {}).get("items", []) or []
        return (
            f"The recurring growth areas for {name} are:\n\n"
            + "\n".join(f"- {i}" for i in items[:3])
            + "\n\nThese map to **homework consistency** and **academic understanding** sub-scores."
        )
    if any(t in msg for t in ["summary", "summarize", "summarise", "progress"]):
        narr = d.get("student_performance", {}).get("narrative", "")
        return narr or f"{name} is progressing steadily — see the report's *Overall Performance* section for the full narrative."
    if any(t in msg for t in ["parent", "home", "help"]):
        items = (d.get("at_home_action_plan") or {}).get("items", []) or []
        if not items:
            items = [{"title": i, "description": ""} for i in d.get("parent_action_items", {}).get("items", [])]
        bullets = "\n".join(f"- **{i.get('title','')}** — {i.get('description','')}".strip(" —")
                            for i in items[:3])
        return f"Three high-leverage things parents can do this month:\n\n{bullets}"
    if any(t in msg for t in ["confidence", "drop", "decline"]):
        return (
            f"The agent's confidence in this report is influenced by transcript coverage "
            f"and the strength of explicit observations. Inferred sections automatically lower "
            f"the score. Open the *Why was this generated?* panel under any inferred section to "
            f"see the supporting evidence — that's the fastest way to spot what's missing."
        )

    return (
        f"I can help with: what changed this month, weak areas, a quick summary, parent guidance, "
        f"or explaining a confidence drop. Try one of those, or ask in your own words."
    )


@router.post("/copilot/message")
async def copilot_message(body: CopilotMessageBody):
    db = await get_db()
    try:
        # Latest report for context
        async with db.execute(
            """SELECT * FROM ptm_reports
               WHERE student_id = ? AND deleted_at IS NULL
               ORDER BY created_at DESC LIMIT 1""",
            [body.student_id],
        ) as cur:
            row = await cur.fetchone()
        latest = row_to_report(row) if row else None

        conv_id = body.conversation_id or str(uuid.uuid4())
        ts = now_iso()
        await db.execute(
            """INSERT INTO ptm_copilot_messages
               (id, student_id, conversation_id, role, content, created_at)
               VALUES (?, ?, ?, 'user', ?, ?)""",
            [str(uuid.uuid4()), body.student_id, conv_id, body.message, ts],
        )
        reply = _copilot_canned_response(body.student_id, body.message, latest)
        await db.execute(
            """INSERT INTO ptm_copilot_messages
               (id, student_id, conversation_id, role, content, created_at)
               VALUES (?, ?, ?, 'assistant', ?, ?)""",
            [str(uuid.uuid4()), body.student_id, conv_id, reply, ts],
        )
        await db.commit()
        return {
            "conversation_id": conv_id,
            "reply": reply,
            "suggested_prompts": [s[1] for s in _COPILOT_INTENTS],
        }
    finally:
        await db.close()


@router.get("/copilot/history")
async def copilot_history(student_id: str, conversation_id: str | None = None, limit: int = 50):
    db = await get_db()
    try:
        if conversation_id:
            sql = """SELECT * FROM ptm_copilot_messages
                     WHERE student_id = ? AND conversation_id = ?
                     ORDER BY created_at ASC LIMIT ?"""
            params = [student_id, conversation_id, limit]
        else:
            sql = """SELECT * FROM ptm_copilot_messages
                     WHERE student_id = ?
                     ORDER BY created_at DESC LIMIT ?"""
            params = [student_id, limit]
        async with db.execute(sql, params) as cur:
            return [dict(r) for r in await cur.fetchall()]
    finally:
        await db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3: knowledge graph
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/students/{student_id}/concepts")
async def list_student_concepts(student_id: str, subject: str | None = None):
    db = await get_db()
    try:
        sql = "SELECT * FROM ptm_student_concepts WHERE student_id = ?"
        params: list = [student_id]
        if subject:
            sql += " AND subject = ?"
            params.append(subject)
        sql += " ORDER BY mastery_score DESC, last_seen_at DESC"
        async with db.execute(sql, params) as cur:
            return [dict(r) for r in await cur.fetchall()]
    finally:
        await db.close()


@router.get("/students/{student_id}/knowledge-summary")
async def knowledge_summary(student_id: str):
    """
    Aggregate signals across this student's reports to power the knowledge dashboard.
    Mockable: derives from existing reports + concepts table; returns shape ready for the UI.
    """
    db = await get_db()
    try:
        async with db.execute(
            """SELECT * FROM ptm_reports
               WHERE student_id = ? AND deleted_at IS NULL
               ORDER BY reporting_month ASC, created_at ASC""",
            [student_id],
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
        for r in rows:
            try:
                r["draft_content"] = json.loads(r["draft_content"])
            except (json.JSONDecodeError, TypeError):
                r["draft_content"] = {}

        topics: dict[str, dict] = {}  # concept → {count, last_month, mastery}
        attendance_trend = []
        confidence_trend = []
        student_name = None
        subject = None
        for r in rows:
            student_name = student_name or r.get("student_name")
            subject = subject or r.get("subject")
            d = r["draft_content"]
            attendance_trend.append({
                "month": r.get("reporting_month"),
                "attendance_pct": d.get("sessions_attendance", {}).get("attendance_pct"),
            })
            confidence_trend.append({
                "month": r.get("reporting_month"),
                "overall_confidence": r.get("overall_confidence"),
            })
            for t in d.get("learning_coverage", {}).get("topics", []) or []:
                key = t.strip()
                if not key:
                    continue
                e = topics.setdefault(key, {"concept": key, "count": 0, "last_month": None})
                e["count"] += 1
                e["last_month"] = r.get("reporting_month")

        # Mastery proxy: more times covered → higher mastery (cap 100)
        mastered = []
        learning = []
        weak_topics = set()
        for r in rows:
            for w in (r["draft_content"].get("growth_areas", {}).get("items") or []):
                weak_topics.add(_topic_stem(w))

        for c in topics.values():
            stem = _topic_stem(c["concept"])
            mastery = min(100, 30 + c["count"] * 22)
            status = "mastered" if mastery >= 80 else "weak" if stem in weak_topics else "learning"
            entry = {
                "concept": c["concept"],
                "mastery_score": mastery,
                "status": status,
                "last_month": c["last_month"],
                "appearances": c["count"],
            }
            (mastered if status == "mastered" else learning).append(entry)

        # Learning velocity: avg new concepts per report
        velocity = round(len(topics) / max(1, len(rows)), 2) if rows else 0.0

        return {
            "student_id": student_id,
            "student_name": student_name,
            "subject": subject,
            "attendance_trend": attendance_trend,
            "confidence_trend": confidence_trend,
            "concepts": [*mastered, *learning],
            "concept_summary": {
                "total": len(topics),
                "mastered": len(mastered),
                "learning": len(learning),
                "weak": sum(1 for c in [*mastered, *learning] if c["status"] == "weak"),
            },
            "learning_velocity": velocity,
            "report_count": len(rows),
        }
    finally:
        await db.close()


def _topic_stem(text: str) -> str:
    return " ".join(w.lower() for w in text.split() if len(w) > 3)[:50]
