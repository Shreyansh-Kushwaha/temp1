"""
Version-history helpers for the regeneration diff view.
"""

from __future__ import annotations

import json


async def list_versions(db, report_id: str) -> list[dict]:
    async with db.execute(
        """SELECT id, version_number, trigger, notes, created_at
           FROM ptm_report_versions
           WHERE report_id = ?
           ORDER BY version_number ASC""",
        [report_id],
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def get_version(db, report_id: str, version_number: int) -> dict | None:
    async with db.execute(
        """SELECT * FROM ptm_report_versions
           WHERE report_id = ? AND version_number = ?""",
        [report_id, version_number],
    ) as cur:
        row = await cur.fetchone()
    if not row:
        return None
    d = dict(row)
    try:
        d["draft_content"] = json.loads(d["draft_content"])
    except (json.JSONDecodeError, TypeError):
        d["draft_content"] = {}
    return d


async def get_pair(
    db, report_id: str, before: int | None, after: int | None
) -> tuple[dict | None, dict | None]:
    """Default: compare version (after-1) vs after. If after is None, use latest."""
    versions = await list_versions(db, report_id)
    if not versions:
        return None, None
    latest = versions[-1]["version_number"]
    after = after or latest
    before = before if before is not None else max(1, after - 1)
    if before == after:
        before = max(1, before - 1)
    a = await get_version(db, report_id, before)
    b = await get_version(db, report_id, after)
    return a, b
