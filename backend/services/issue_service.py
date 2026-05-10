"""
Issue / support-ticket service.

Issues are the queue that the support team works through. Anything we detect
in the data (missing parent email, broken delivery, etc.) becomes a row here
so it doesn't get lost. Designed generically so adding a new `type` doesn't
require schema changes.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from db.connection import get_db

logger = logging.getLogger("ptm.issues")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── CRUD ──────────────────────────────────────────────────────────────────


async def list_issues(
    status: str | None = None,
    type_: str | None = None,
    severity: str | None = None,
    q: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> tuple[list[dict], int]:
    where = ["1=1"]
    args: list = []
    if status:
        wanted = [s.strip() for s in status.split(",") if s.strip()]
        if wanted:
            where.append(f"status IN ({','.join(['?'] * len(wanted))})")
            args.extend(wanted)
    if type_:
        wanted = [t.strip() for t in type_.split(",") if t.strip()]
        if wanted:
            where.append(f"type IN ({','.join(['?'] * len(wanted))})")
            args.extend(wanted)
    if severity:
        wanted = [s.strip() for s in severity.split(",") if s.strip()]
        if wanted:
            where.append(f"severity IN ({','.join(['?'] * len(wanted))})")
            args.extend(wanted)
    if q:
        like = f"%{q.strip()}%"
        where.append("(title ILIKE ? OR entity_name ILIKE ? OR description ILIKE ?)")
        args.extend([like, like, like])

    where_sql = " AND ".join(where)
    db = await get_db()
    try:
        async with db.execute(
            f"SELECT COUNT(*) FROM ptm_issues WHERE {where_sql}", args
        ) as cur:
            (total,) = await cur.fetchone()

        async with db.execute(
            f"""SELECT id, type, status, severity, title, description,
                       entity_type, entity_id, entity_name, metadata,
                       created_by, created_at, updated_at,
                       resolved_at, resolved_by, resolution_note
                FROM ptm_issues
                WHERE {where_sql}
                ORDER BY
                    CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
                    CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                    created_at DESC
                LIMIT ? OFFSET ?""",
            args + [limit, offset],
        ) as cur:
            rows = await cur.fetchall()
    finally:
        await db.close()

    entries = [
        {
            "id": r[0],
            "type": r[1],
            "status": r[2],
            "severity": r[3],
            "title": r[4],
            "description": r[5],
            "entity_type": r[6],
            "entity_id": r[7],
            "entity_name": r[8],
            "metadata": _maybe_json(r[9]),
            "created_by": r[10],
            "created_at": r[11],
            "updated_at": r[12],
            "resolved_at": r[13],
            "resolved_by": r[14],
            "resolution_note": r[15],
        }
        for r in rows
    ]
    return entries, int(total or 0)


def _maybe_json(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return value
    return value


async def upsert_issue(
    *,
    type_: str,
    title: str,
    severity: str = "medium",
    description: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    entity_name: str | None = None,
    metadata: dict | None = None,
    created_by: str = "system",
) -> tuple[bool, str]:
    """Insert a new open issue or — if one already exists for this
    (type, entity_id) — refresh its updated_at and return existing id.

    Returns (was_new, issue_id).
    """
    ts = _now()
    db = await get_db()
    try:
        # Look for an existing OPEN issue (the unique partial index would also
        # protect against dupes on insert, but checking lets us refresh metadata).
        if entity_id:
            async with db.execute(
                "SELECT id FROM ptm_issues WHERE type=? AND entity_id=? AND status='open' LIMIT 1",
                [type_, entity_id],
            ) as cur:
                existing = await cur.fetchone()
            if existing:
                await db.execute(
                    "UPDATE ptm_issues SET updated_at=?, title=?, description=?, severity=?, "
                    "entity_name=COALESCE(?, entity_name), metadata=? WHERE id=?",
                    [
                        ts, title, description, severity, entity_name,
                        json.dumps(metadata) if metadata is not None else None,
                        existing[0],
                    ],
                )
                await db.commit()
                return False, str(existing[0])

        new_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO ptm_issues
               (id, type, status, severity, title, description,
                entity_type, entity_id, entity_name, metadata,
                created_by, created_at, updated_at)
               VALUES (?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                new_id, type_, severity, title, description,
                entity_type, entity_id, entity_name,
                json.dumps(metadata) if metadata is not None else None,
                created_by, ts, ts,
            ],
        )
        await db.commit()
        return True, new_id
    finally:
        await db.close()


async def update_issue_status(
    issue_id: str,
    status: str,
    *,
    resolution_note: str | None = None,
    resolved_by: str | None = None,
) -> bool:
    if status not in ("open", "in_progress", "resolved", "wont_fix"):
        raise ValueError(f"Invalid status: {status}")
    ts = _now()
    db = await get_db()
    try:
        if status in ("resolved", "wont_fix"):
            await db.execute(
                "UPDATE ptm_issues SET status=?, updated_at=?, resolved_at=?, "
                "resolved_by=?, resolution_note=COALESCE(?, resolution_note) WHERE id=?",
                [status, ts, ts, resolved_by or "user", resolution_note, issue_id],
            )
        else:
            await db.execute(
                "UPDATE ptm_issues SET status=?, updated_at=?, resolved_at=NULL, "
                "resolved_by=NULL WHERE id=?",
                [status, ts, issue_id],
            )
        await db.commit()
        return True
    finally:
        await db.close()


# ── Checks ────────────────────────────────────────────────────────────────


async def run_email_records_check() -> dict:
    """Scan every active classroom enrollment in Wise; raise an issue for any
    student with no parent email on record. Idempotent — re-running won't
    duplicate open tickets.

    Returns a summary suitable for showing in a toast:
      {checked, missing, opened, already_open}
    """
    import os
    if not os.getenv("MONGO_CONNECTION_STRING", "").strip():
        logger.warning("Email-records check skipped: MONGO_CONNECTION_STRING not set")
        return {"checked": 0, "missing": 0, "opened": 0, "already_open": 0}

    from db.mongo import get_mongo_db
    from services.wise_service import _extract_subject_from_batch_code

    db = get_mongo_db()
    sc = db["wise_student_classrooms"]

    checked = 0
    missing: list[dict] = []

    cursor = sc.find(
        {},
        {
            "wise_class_id": 1,
            "wise_student_id": 1,
            "student_name": 1,
            "student_email": 1,
            "classroom_subject_raw": 1,
            "active": 1,
        },
    )
    async for d in cursor:
        if d.get("active") is False:
            continue
        wise_class_id = (d.get("wise_class_id") or "").strip()
        if not wise_class_id:
            continue
        checked += 1
        email = (d.get("student_email") or "").strip()
        if email:
            continue
        missing.append(
            {
                "student_id": wise_class_id,
                "student_name": (d.get("student_name") or "Unknown").strip(),
                "wise_student_id": d.get("wise_student_id"),
                "subject": _extract_subject_from_batch_code(
                    d.get("classroom_subject_raw") or ""
                ),
                "classroom_subject_raw": d.get("classroom_subject_raw"),
            }
        )

    opened = 0
    already_open = 0
    for m in missing:
        was_new, _ = await upsert_issue(
            type_="email_missing",
            severity="medium",
            title=f"No email on record for {m['student_name']}",
            description=(
                f"Wise classroom record for {m['student_name']}"
                + (f" ({m['subject']})" if m["subject"] else "")
                + " has no parent/student email. Approving a report for this "
                "classroom will skip email delivery."
            ),
            entity_type="student",
            entity_id=m["student_id"],
            entity_name=m["student_name"],
            metadata={
                "wise_student_id": m["wise_student_id"],
                "subject": m["subject"],
                "classroom_subject_raw": m["classroom_subject_raw"],
            },
            created_by="system_check",
        )
        if was_new:
            opened += 1
        else:
            already_open += 1

    summary = {
        "checked": checked,
        "missing": len(missing),
        "opened": opened,
        "already_open": already_open,
    }
    logger.info("Email-records check: %s", summary)
    return summary
