"""
Student knowledge dashboard — AI generation via Azure OpenAI GPT-5.1.

Pulls Wise session summaries (from Mongo) and any existing PTM reports, then
asks GPT-5.1 to produce a structured snapshot of the student's mastery,
attendance pattern, learning velocity, and concept-level status.

Modes:
- "create": fresh generation, ignores prior payload.
- "update": passes the prior payload as context and asks the model to
  refine / extend it (so concept lists grow rather than reset).
"""

import json
import logging
import os
from typing import Any

logger = logging.getLogger("ptm.knowledge")


SYSTEM_PROMPT = """You are an academic-intelligence assistant. From the inputs
provided you build a Student Knowledge Snapshot.

INPUTS you may receive:
- WISE_SESSIONS  — session-level summaries / transcript excerpts
- PTM_REPORTS    — already-generated parent-teacher reports for prior months
- PRIOR_SNAPSHOT — your previous output for this student (only on update)

GOAL:
Identify the concepts / topics this student has worked on, their mastery
level, recurring strengths, weaknesses, attendance pattern, and any insight
worth surfacing to a teacher. Be evidence-led — every concept you list MUST
be present in either the sessions, the reports, or the prior snapshot.

Return ONLY a valid JSON object with this exact shape:
{
  "student_name": "<string, copied through>",
  "subject":      "<string, best-effort from inputs>",
  "concepts": [
    {
      "concept":        "<short topic name, ≤6 words>",
      "mastery_score":  <integer 0–100>,
      "status":         "mastered" | "learning" | "weak",
      "appearances":    <integer ≥ 1>,
      "last_month":     "<YYYY-MM-01 or empty>",
      "evidence":       "<≤140-char excerpt from a session/report>"
    }
  ],
  "concept_summary": {
    "total":    <int>,
    "mastered": <int>,
    "learning": <int>,
    "weak":     <int>
  },
  "attendance_trend": [
    { "month": "<YYYY-MM-01>", "attendance_pct": <int 0–100 or null> }
  ],
  "confidence_trend": [
    { "month": "<YYYY-MM-01>", "overall_confidence": <int 0–100 or null> }
  ],
  "learning_velocity": <number, avg new concepts per month>,
  "report_count":      <int>,
  "insights":          ["<sentence>", ...]
}

RULES:
- mastery_score ≥ 80 → status "mastered". 40–79 → "learning". <40 → "weak".
  Override to "weak" if the inputs explicitly call the topic a struggle.
- concepts array: at least 4 entries when sessions exist; merge near-duplicates
  ("Quadratic equations" + "Solving quadratics" → one entry, count both).
- concept_summary counts MUST match the concepts array.
- attendance_trend / confidence_trend: only include months you actually have
  signal for. Empty arrays are fine.
- insights: 2–4 short sentences (each ≤25 words) highlighting non-obvious
  patterns the teacher should know.
- UPDATE mode: keep every concept from PRIOR_SNAPSHOT unless inputs clearly
  contradict it. Add newly observed concepts. Bump appearances / mastery
  when new sessions reinforce a topic.
- No code fences. No commentary. Only the JSON object."""


def _build_user_prompt(
    sessions: list[dict],
    reports: list[dict],
    prior: dict | None,
    student_name: str | None,
    subject: str | None,
    mode: str,
) -> str:
    parts: list[str] = []
    parts.append(f"MODE: {mode}")
    parts.append(f"STUDENT_NAME: {student_name or '(unknown)'}")
    parts.append(f"SUBJECT: {subject or '(unknown)'}")

    if sessions:
        block = []
        for i, s in enumerate(sessions[:25], start=1):
            text = (s.get("transcript_excerpt") or s.get("topic_summary") or "").strip()
            if not text:
                continue
            block.append(f"[{i}] ({s.get('date') or 'date n/a'}) {text}")
        if block:
            parts.append("WISE_SESSIONS:\n" + "\n\n".join(block))

    if reports:
        report_lines = []
        for r in reports[:6]:
            d = r.get("draft_content") or {}
            report_lines.append(json.dumps({
                "month": r.get("reporting_month"),
                "attendance_pct": (d.get("sessions_attendance") or {}).get("attendance_pct"),
                "overall_confidence": r.get("overall_confidence"),
                "topics_covered": (d.get("learning_coverage") or {}).get("topics") or [],
                "growth_areas": (d.get("growth_areas") or {}).get("items") or [],
                "strengths": (d.get("strengths") or {}).get("items") or [],
                "performance_narrative": (d.get("student_performance") or {}).get("narrative"),
            }, ensure_ascii=False))
        if report_lines:
            parts.append("PTM_REPORTS:\n" + "\n\n".join(report_lines))

    if prior:
        parts.append("PRIOR_SNAPSHOT:\n" + json.dumps(prior, ensure_ascii=False))

    return "\n\n".join(parts)


async def generate(
    *,
    student_id: str,
    student_name: str | None,
    subject: str | None,
    sessions: list[dict],
    reports: list[dict],
    prior: dict | None,
    mode: str,
) -> dict | None:
    """Calls Azure OpenAI GPT-5.1. Returns the parsed snapshot dict, or None
    on failure (caller should fall back / 502)."""
    if not os.getenv("AZURE_OPENAI_API_KEY", "").strip():
        return None
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip()
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "").strip()
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview").strip()
    if not endpoint or not deployment:
        return None

    user_prompt = _build_user_prompt(sessions, reports, prior, student_name, subject, mode)
    logger.info(
        "knowledge.generate: student=%s mode=%s sessions=%d reports=%d prior=%s chars=%d",
        student_id, mode, len(sessions), len(reports), bool(prior), len(user_prompt),
    )

    try:
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            azure_endpoint=endpoint,
            api_version=api_version,
        )
        response = await client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=8192,
        )
    except Exception as e:
        logger.warning("knowledge.generate LLM call failed: %s", e)
        return None

    try:
        content = response.choices[0].message.content or ""
        parsed = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError, AttributeError) as e:
        logger.warning("knowledge.generate unparseable JSON: %s", e)
        return None

    # Defensive normalisation — the UI relies on these shapes.
    parsed.setdefault("student_name", student_name)
    parsed.setdefault("subject", subject)
    parsed.setdefault("attendance_trend", [])
    parsed.setdefault("confidence_trend", [])
    parsed.setdefault("insights", [])

    concepts = parsed.get("concepts") or []
    if not isinstance(concepts, list):
        concepts = []
    cleaned: list[dict[str, Any]] = []
    for c in concepts:
        if not isinstance(c, dict) or not c.get("concept"):
            continue
        try:
            score = int(c.get("mastery_score") or 0)
        except (TypeError, ValueError):
            score = 0
        score = max(0, min(100, score))
        status = c.get("status")
        if status not in ("mastered", "learning", "weak"):
            status = "mastered" if score >= 80 else "weak" if score < 40 else "learning"
        try:
            appearances = max(1, int(c.get("appearances") or 1))
        except (TypeError, ValueError):
            appearances = 1
        cleaned.append({
            "concept": str(c.get("concept")).strip()[:60],
            "mastery_score": score,
            "status": status,
            "appearances": appearances,
            "last_month": str(c.get("last_month") or "")[:10],
            "evidence": str(c.get("evidence") or "")[:160],
        })
    parsed["concepts"] = cleaned
    parsed["concept_summary"] = {
        "total":    len(cleaned),
        "mastered": sum(1 for c in cleaned if c["status"] == "mastered"),
        "learning": sum(1 for c in cleaned if c["status"] == "learning"),
        "weak":     sum(1 for c in cleaned if c["status"] == "weak"),
    }
    try:
        parsed["learning_velocity"] = float(parsed.get("learning_velocity") or 0)
    except (TypeError, ValueError):
        parsed["learning_velocity"] = 0.0
    try:
        parsed["report_count"] = int(parsed.get("report_count") or len(reports))
    except (TypeError, ValueError):
        parsed["report_count"] = len(reports)

    parsed["student_id"] = student_id
    return parsed
