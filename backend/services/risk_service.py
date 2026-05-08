"""
Risk detection — compares a student's recent report(s) to history.

Signals detected:
  - attendance_drop:        attendance_pct fell ≥10 points vs prior month
  - confidence_decline:     overall_confidence fell ≥15 points vs prior month
  - engagement_drop:        engagement sub-score fell ≥15 points vs prior month
  - recurring_weakness:     same growth_area surfaces in ≥2 consecutive reports
  - homework_inconsistency: homework_consistency sub-score < 50 in current report
  - burnout:                attendance + engagement BOTH dropped meaningfully

Severity thresholds:
  high   — drop ≥25 points or ≥3 consecutive recurring weaknesses
  medium — drop ≥15 points or 2 recurring weaknesses
  low    — drop ≥10 points or single weak signal

Output is persisted into ptm_risk_signals so the dashboard can render without re-computing.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Literal

logger = logging.getLogger(__name__)

SignalType = Literal[
    "attendance_drop",
    "confidence_decline",
    "engagement_drop",
    "recurring_weakness",
    "homework_inconsistency",
    "burnout",
]
Severity = Literal["low", "medium", "high"]
Trend = Literal["up", "down", "flat"]


@dataclass
class RiskSignal:
    student_id: str
    report_id: str | None
    signal_type: SignalType
    severity: Severity
    trend: Trend
    delta: float | None
    description: str
    evidence: list[dict]


SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3}


def _severity_for_drop(drop: float) -> Severity:
    if drop >= 25:
        return "high"
    if drop >= 15:
        return "medium"
    return "low"


def _row_draft(row: dict) -> dict:
    raw = row.get("draft_content")
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}
    return {}


def detect_for_history(student_id: str, history: list[dict]) -> list[RiskSignal]:
    """`history` ordered oldest → newest. Each row is a ptm_reports row dict."""
    signals: list[RiskSignal] = []
    if len(history) < 1:
        return signals

    current = history[-1]
    prior = history[-2] if len(history) >= 2 else None
    cur_draft = _row_draft(current)

    # ── attendance_drop ──
    if prior:
        prior_draft = _row_draft(prior)
        cur_att = cur_draft.get("sessions_attendance", {}).get("attendance_pct")
        prev_att = prior_draft.get("sessions_attendance", {}).get("attendance_pct")
        if isinstance(cur_att, (int, float)) and isinstance(prev_att, (int, float)):
            drop = prev_att - cur_att
            if drop >= 10:
                signals.append(RiskSignal(
                    student_id=student_id,
                    report_id=current["id"],
                    signal_type="attendance_drop",
                    severity=_severity_for_drop(drop),
                    trend="down",
                    delta=-drop,
                    description=f"Attendance fell from {prev_att}% to {cur_att}% versus prior month.",
                    evidence=[
                        {"metric": "attendance_pct", "prior": prev_att, "current": cur_att,
                         "prior_month": prior.get("reporting_month"),
                         "current_month": current.get("reporting_month")}
                    ],
                ))

    # ── confidence_decline ──
    if prior:
        cur_conf = current.get("overall_confidence")
        prev_conf = prior.get("overall_confidence")
        if isinstance(cur_conf, (int, float)) and isinstance(prev_conf, (int, float)):
            drop = prev_conf - cur_conf
            if drop >= 15:
                signals.append(RiskSignal(
                    student_id=student_id,
                    report_id=current["id"],
                    signal_type="confidence_decline",
                    severity=_severity_for_drop(drop),
                    trend="down",
                    delta=-drop,
                    description=f"AI confidence dropped from {prev_conf} to {cur_conf} — observable signal weakened.",
                    evidence=[{"metric": "overall_confidence", "prior": prev_conf, "current": cur_conf}],
                ))

    # ── engagement_drop ──
    if prior:
        prior_draft = _row_draft(prior)
        cur_eng = (cur_draft.get("ai_confidence") or {}).get("sections", {}).get("engagement")
        prev_eng = (prior_draft.get("ai_confidence") or {}).get("sections", {}).get("engagement")
        if isinstance(cur_eng, (int, float)) and isinstance(prev_eng, (int, float)):
            drop = prev_eng - cur_eng
            if drop >= 15:
                signals.append(RiskSignal(
                    student_id=student_id,
                    report_id=current["id"],
                    signal_type="engagement_drop",
                    severity=_severity_for_drop(drop),
                    trend="down",
                    delta=-drop,
                    description=f"Engagement signals weakened ({prev_eng}→{cur_eng}).",
                    evidence=[{"metric": "engagement", "prior": prev_eng, "current": cur_eng}],
                ))

    # ── homework_inconsistency ──
    cur_hw = (cur_draft.get("ai_confidence") or {}).get("sections", {}).get("homework_consistency")
    if isinstance(cur_hw, (int, float)) and cur_hw < 50:
        sev: Severity = "high" if cur_hw < 30 else "medium" if cur_hw < 40 else "low"
        signals.append(RiskSignal(
            student_id=student_id,
            report_id=current["id"],
            signal_type="homework_inconsistency",
            severity=sev,
            trend="flat",
            delta=cur_hw,
            description="Homework consistency signal is weak — unclear or sparse evidence of regular at-home practice.",
            evidence=[{"metric": "homework_consistency", "current": cur_hw}],
        ))

    # ── recurring_weakness ──
    growth_lists: list[list[str]] = []
    for h in history[-3:]:
        d = _row_draft(h)
        items = d.get("growth_areas", {}).get("items") or []
        growth_lists.append([_norm(i) for i in items if i])

    if len(growth_lists) >= 2:
        from collections import Counter
        counts: Counter[str] = Counter()
        for items in growth_lists:
            for stem in set(items):
                counts[stem] += 1
        recurring = [stem for stem, c in counts.items() if c >= 2]
        if recurring:
            sev = "high" if any(c >= 3 for c in counts.values()) else "medium"
            signals.append(RiskSignal(
                student_id=student_id,
                report_id=current["id"],
                signal_type="recurring_weakness",
                severity=sev,
                trend="flat",
                delta=float(max(counts.values())),
                description=(
                    f"Same growth area appears across {max(counts.values())} consecutive reports "
                    f"({', '.join(recurring[:3])})."
                ),
                evidence=[{"recurring": recurring, "spans_reports": len(growth_lists)}],
            ))

    # ── burnout ── (compound: attendance + engagement both down)
    have_att = any(s.signal_type == "attendance_drop" for s in signals)
    have_eng = any(s.signal_type == "engagement_drop" for s in signals)
    if have_att and have_eng:
        signals.append(RiskSignal(
            student_id=student_id,
            report_id=current["id"],
            signal_type="burnout",
            severity="high",
            trend="down",
            delta=None,
            description="Combined drop in attendance AND engagement — possible burnout indicator.",
            evidence=[{"compound": ["attendance_drop", "engagement_drop"]}],
        ))

    return signals


def _norm(text: str) -> str:
    """Stem-ish normalization for matching growth areas across reports."""
    return " ".join(w.lower() for w in text.split() if len(w) > 3)[:60]


# ── Persistence ──────────────────────────────────────────────────────────────

async def replace_signals_for_student(db, student_id: str, signals: list[RiskSignal]) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    # Mark previous unresolved signals as resolved (current run is the latest truth)
    await db.execute(
        "UPDATE ptm_risk_signals SET resolved_at=? WHERE student_id=? AND resolved_at IS NULL",
        [ts, student_id],
    )
    for sig in signals:
        await db.execute(
            """INSERT INTO ptm_risk_signals
               (id, student_id, report_id, signal_type, severity, trend, delta,
                description, evidence, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                str(uuid.uuid4()), sig.student_id, sig.report_id, sig.signal_type,
                sig.severity, sig.trend, sig.delta, sig.description,
                json.dumps(sig.evidence), ts,
            ],
        )


async def list_active_signals(db, *, severity: str | None = None) -> list[dict]:
    sql = "SELECT * FROM ptm_risk_signals WHERE resolved_at IS NULL"
    params: list = []
    if severity:
        sql += " AND severity = ?"
        params.append(severity)
    sql += " ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC"
    async with db.execute(sql, params) as cur:
        rows = await cur.fetchall()
    out = []
    for r in rows:
        d = dict(r)
        if d.get("evidence"):
            try:
                d["evidence"] = json.loads(d["evidence"])
            except json.JSONDecodeError:
                d["evidence"] = []
        else:
            d["evidence"] = []
        out.append(d)
    return out


def serialize(sig: RiskSignal) -> dict:
    return asdict(sig)
