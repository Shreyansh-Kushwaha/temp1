"""
Teacher-form auto-fill — Azure OpenAI GPT-5.1.

Reads the selected session summaries / transcripts and returns suggested values
for the teacher-assessment form fields (engagement, concept understanding, and
the free-text fields). Intended as a starting point a teacher can edit.
"""

import json
import logging
import os

logger = logging.getLogger("ptm.form_assist")


ENGAGEMENT_OPTIONS = [
    "Highly engaged — asked questions and contributed actively",
    "Engaged — participated when prompted",
    "Moderately engaged — some focus drift",
    "Needed encouragement to stay engaged",
    "Distracted for most of the class",
]

CONCEPT_OPTIONS = [
    "Mastered the concept independently",
    "Understood with minimal guidance",
    "Understood after multiple examples",
    "Partially understood — needs revision",
    "Needs significant reinforcement",
]


SYSTEM_PROMPT = f"""You are an assistant that drafts a teacher's PTM-form assessment
from raw class session summaries / transcripts. The teacher will review and edit
your draft before submitting — so make a confident best-effort draft, do NOT
leave fields blank just because you're uncertain.

You MUST return ONLY a valid JSON object with exactly these keys:
{{
  "engagement_level": "<one of the engagement options below>",
  "concept_understanding": "<one of the concept options below>",
  "homework_effort": "<2–3 sentence observation about effort/consistency>",
  "specific_highlights": "<2–3 sentence observation of standout moments>",
  "improvement_areas": "<2–3 sentence observation phrased constructively>",
  "next_month_goals": ["<short goal>", "<short goal>", ...]
}}

ENGAGEMENT options (pick the closest match):
{chr(10).join(f"- {o}" for o in ENGAGEMENT_OPTIONS)}

CONCEPT_UNDERSTANDING options (pick the closest match):
{chr(10).join(f"- {o}" for o in CONCEPT_OPTIONS)}

Rules:
- ALWAYS make a best-effort inference for every field — even if the session
  text is brief, pick the most plausible engagement/concept option and write
  reasonable observations that a teacher would plausibly write after reading
  these sessions. The teacher will edit anything they disagree with.
- ONLY return an empty value if there is literally zero relevant text across
  ALL sessions for that aspect (extremely rare).
- Free-text fields: full sentences, plain English, written FROM the teacher's
  perspective ("Arjun consistently…"), NOT addressed to the teacher.
- next_month_goals: 2–4 short imperative phrases (≤8 words each) like
  "Practice quadratic word problems weekly".
- Engagement / concept dropdowns: the value MUST be exactly one of the option
  strings above, character-for-character (including the em-dash "—" and case).
- No code fences. No commentary. Only the JSON object."""


async def auto_fill(
    sessions: list[dict],
    student_name: str | None = None,
    subject: str | None = None,
) -> dict:
    """Returns a dict of suggested form values. Falls back to empty values if
    Azure OpenAI is not configured or the call fails — the UI then leaves the
    fields blank for the teacher to fill manually."""

    empty = {
        "engagement_level": "",
        "concept_understanding": "",
        "homework_effort": "",
        "specific_highlights": "",
        "improvement_areas": "",
        "next_month_goals": [],
    }

    if not os.getenv("AZURE_OPENAI_API_KEY", "").strip():
        return empty

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip()
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "").strip()
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview").strip()
    if not endpoint or not deployment:
        return empty

    sessions_block = []
    for i, s in enumerate(sessions, start=1):
        sessions_block.append(
            f"Session {i} ({s.get('date') or 'date n/a'}):\n"
            f"{(s.get('transcript_excerpt') or s.get('topic_summary') or '').strip()}"
        )
    user_prompt = (
        f"Student: {student_name or 'the student'}\n"
        f"Subject: {subject or 'general'}\n"
        f"Sessions selected for this report ({len(sessions)} total):\n\n"
        + "\n\n---\n\n".join(sessions_block)
    )

    # Log a truncated copy so we can verify content actually reached the model
    # if the output looks empty.
    logger.info(
        "auto_fill input: student=%s subject=%s sessions=%d chars=%d preview=%r",
        student_name, subject, len(sessions), len(user_prompt), user_prompt[:300],
    )

    try:
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            azure_endpoint=endpoint,
            api_version=api_version,
        )
        # gpt-5.1 is a reasoning model — internal reasoning tokens count
        # against max_completion_tokens, so a low budget will starve the
        # output and leave us with the empty JSON scaffold. 8192 leaves
        # comfortable room for both reasoning and the structured reply.
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
        logger.warning("auto_fill LLM call failed: %s", e)
        return empty

    try:
        content = response.choices[0].message.content or ""
        logger.info("auto_fill raw response: %s", content[:500])
        parsed = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError, AttributeError) as e:
        logger.warning("auto_fill returned unparseable JSON: %s", e)
        return empty

    engagement = _match_option(parsed.get("engagement_level"), ENGAGEMENT_OPTIONS)
    concept = _match_option(parsed.get("concept_understanding"), CONCEPT_OPTIONS)

    goals_raw = parsed.get("next_month_goals") or []
    goals = [str(g).strip() for g in goals_raw if str(g).strip()][:6]

    return {
        "engagement_level": engagement,
        "concept_understanding": concept,
        "homework_effort": str(parsed.get("homework_effort") or "").strip(),
        "specific_highlights": str(parsed.get("specific_highlights") or "").strip(),
        "improvement_areas": str(parsed.get("improvement_areas") or "").strip(),
        "next_month_goals": goals,
    }


def _normalize(s: str) -> str:
    """Lowercase, fold em/en-dashes to '-', collapse whitespace."""
    s = s.lower().strip()
    for ch in ("—", "–", "−"):
        s = s.replace(ch, "-")
    return " ".join(s.split())


def _match_option(raw, options: list[str]) -> str:
    """Try exact match first; then fall back to normalized match (so em-dash
    vs hyphen, casing, or stray spaces don't kill an otherwise-correct pick).
    Then try matching by the leading label (e.g. 'Mastered the concept...')."""
    val = str(raw or "").strip()
    if not val:
        return ""
    if val in options:
        return val
    nval = _normalize(val)
    for opt in options:
        if _normalize(opt) == nval:
            return opt
    # Loose match: leading clause before the dash (e.g. "Highly engaged")
    head = nval.split("-", 1)[0].strip()
    if head:
        for opt in options:
            opt_head = _normalize(opt).split("-", 1)[0].strip()
            if opt_head and opt_head == head:
                return opt
    return ""
