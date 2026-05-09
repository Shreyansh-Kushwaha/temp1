"""
PTM Copilot — Azure OpenAI GPT-5.1.

If AZURE_OPENAI_API_KEY is set → real LLM reply grounded in the latest report.
Otherwise → returns None so the caller can fall back to its canned responses.
"""

import json
import logging
import os
from typing import Any

logger = logging.getLogger("ptm.copilot")


SYSTEM_PROMPT = """You are the PTM Copilot for Super Sheldon — an assistant that helps
teachers and managers reason about a student's progress.

Ground every answer in the STUDENT CONTEXT block provided in the user message.
You have two sources to draw on:
- The PTM REPORT fields (when `report_available` is true) — already-summarised
  per-section narratives, strengths, growth areas, etc.
- The RECENT SESSIONS array — raw Wise session summaries / transcript excerpts
  per class. Use these for session-specific questions ("what did we cover on
  March 14?", "how did the student do with Topic X?", "any signs of
  disengagement?", "give me a timeline of what was taught"). When sessions
  contradict or add nuance to the report, prefer the sessions.

If `report_available` is false, sessions are your ONLY source — DO NOT say
"no report" or refuse to answer. Summarise from the sessions you have. Only
say something is unknown if it truly isn't anywhere in the context.

Style:
- Warm, professional, concise. Plain English, no jargon.
- 2–6 sentences unless the user explicitly asks for more.
- Use short markdown bullets where it actually helps; otherwise prose.
- Never reveal the raw JSON or schema field names — translate them.

Output: return ONLY a valid JSON object with this shape:
{
  "reply": "<your answer to the teacher>",
  "suggested_prompts": ["<3 short follow-up questions the teacher might ask next>"]
}
suggested_prompts must be exactly 3 entries, each ≤6 words, contextual to the
current student and conversation. No code fences, no extra keys."""


def _format_sessions(sessions: list[dict] | None) -> list[dict]:
    """Project Wise session docs into the compact form the copilot consumes.
    Includes the full per-session summary so questions like 'what happened on
    March 14' or 'when did topic X come up' can be answered specifically."""
    out: list[dict] = []
    for s in (sessions or [])[:20]:
        out.append({
            "session_id": s.get("session_id"),
            "date": s.get("date"),
            "topic_summary": s.get("topic_summary"),
            "transcript_excerpt": s.get("transcript_excerpt") or "",
        })
    return out


def _condense_report(
    report: dict | None,
    student_id: str | None = None,
    student_name: str | None = None,
    sessions: list[dict] | None = None,
) -> dict:
    """Build the grounding context.
    Always includes Wise session data when available — even if a PTM report
    exists, the copilot can dig into specific sessions for follow-up questions.
    """
    session_block = _format_sessions(sessions)

    if report:
        d = report.get("draft_content") or {}
        confidence = d.get("ai_confidence") or {}
        return {
            "report_available": True,
            "student_id": report.get("student_id") or student_id,
            "student_name": report.get("student_name") or student_name,
            "subject": report.get("subject"),
            "teacher_name": report.get("teacher_name"),
            "month": report.get("month"),
            "status": report.get("status"),
            "topics_covered": (d.get("learning_coverage") or {}).get("topics") or [],
            "next_steps": (d.get("next_steps") or {}).get("topics") or [],
            "performance_narrative": (d.get("student_performance") or {}).get("narrative"),
            "confidence_trend": (d.get("confidence_trend") or {}).get("level"),
            "strengths": (d.get("strengths") or {}).get("items") or [],
            "growth_areas": (d.get("growth_areas") or {}).get("items") or [],
            "homework_and_effort": (d.get("homework_and_effort") or {}).get("narrative"),
            "milestone": (d.get("milestone_of_month") or {}).get("description"),
            "parent_action_items": (d.get("parent_action_items") or {}).get("items") or [],
            "at_home_action_plan": [
                {"title": i.get("title"), "category": i.get("category"), "description": i.get("description")}
                for i in ((d.get("at_home_action_plan") or {}).get("items") or [])
            ],
            "recommended_resources": (d.get("recommended_resources") or {}).get("items") or [],
            "encouragement_message": d.get("encouragement_message"),
            "ai_confidence_overall": confidence.get("overall"),
            "ai_confidence_sections": confidence.get("sections") or {},
            "inferred_fields": d.get("_inferred_fields") or [],
            # Always pass Wise session detail too — the report is already a
            # condensed view; the raw sessions let the copilot answer
            # session-specific questions ("what did we do on April 14?").
            "recent_sessions": session_block,
        }

    # No report yet — sessions are the only ground truth.
    return {
        "report_available": False,
        "student_id": student_id,
        "student_name": student_name,
        "note": (
            "No PTM report has been generated for this student yet. Use the "
            "Wise session summaries below to answer the teacher's questions."
        ),
        "recent_sessions": session_block,
    }


def _build_messages(
    message: str,
    context: dict,
    history: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """Compose the chat-completions message list."""
    msgs: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Replay prior conversation turns (already stored in DB).
    for h in history:
        role = h.get("role")
        content = h.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            msgs.append({"role": role, "content": content})

    user_block = (
        "STUDENT CONTEXT (the student this conversation is about):\n"
        f"{json.dumps(context, ensure_ascii=False, indent=2)}\n\n"
        f"TEACHER'S MESSAGE:\n{message}"
    )
    msgs.append({"role": "user", "content": user_block})
    return msgs


async def chat(
    message: str,
    latest_report: dict | None,
    history: list[dict[str, Any]] | None = None,
    *,
    student_id: str | None = None,
    student_name: str | None = None,
    sessions: list[dict] | None = None,
) -> dict | None:
    """
    Returns {"reply": str, "suggested_prompts": [str, str, str]} on success,
    or None if Azure OpenAI is not configured / call fails — caller should fall back.
    """
    if not os.getenv("AZURE_OPENAI_API_KEY", "").strip():
        return None

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip()
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "").strip()
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview").strip()
    if not endpoint or not deployment:
        logger.warning("Copilot: Azure OpenAI endpoint/deployment missing — falling back to canned.")
        return None

    try:
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            azure_endpoint=endpoint,
            api_version=api_version,
        )
        context = _condense_report(latest_report, student_id, student_name, sessions)
        response = await client.chat.completions.create(
            model=deployment,
            messages=_build_messages(message, context, history or []),
            response_format={"type": "json_object"},
            max_completion_tokens=2048,
        )
    except Exception as e:  # broad: copilot is non-critical, never 500 the chat
        logger.warning("Copilot LLM call failed: %s — falling back to canned.", e)
        return None

    try:
        content = response.choices[0].message.content or ""
        parsed = json.loads(content.strip())
        reply = str(parsed.get("reply") or "").strip()
        prompts_raw = parsed.get("suggested_prompts") or []
        prompts = [str(p).strip() for p in prompts_raw if str(p).strip()][:3]
        if not reply:
            return None
        # Always return exactly 3 suggested prompts; pad with sane defaults.
        defaults = [
            "What changed this month?",
            "Weak areas?",
            "Parent guidance?",
        ]
        while len(prompts) < 3:
            for d in defaults:
                if d not in prompts:
                    prompts.append(d)
                    break
        return {"reply": reply, "suggested_prompts": prompts[:3]}
    except (json.JSONDecodeError, IndexError, AttributeError) as e:
        logger.warning("Copilot LLM returned unparseable response: %s", e)
        return None
