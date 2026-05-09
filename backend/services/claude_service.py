"""
Report generation service — Gemini 2.5 Flash.
If GEMINI_API_KEY is set → real Gemini call.
If not set → returns a deterministic mock draft so the full flow works without a key.

The output JSON now also includes:
  - ai_confidence:        overall (0-100) + per-section sub-scores
  - _evidence:            evidence array per inferred field (session refs + snippets)
  - at_home_action_plan:  practical parent action items grouped by category
  - audio_script:         45–60s parent-friendly summary script (used by tts_service)

Tone is controlled via two axes:
  - warmth: warm | balanced | formal
  - detail: concise | balanced | detailed
"""

import json
import os
from typing import Literal, TypedDict

ToneWarmth = Literal["warm", "balanced", "formal"]
ToneDetail = Literal["concise", "balanced", "detailed"]


class ToneOptions(TypedDict, total=False):
    warmth: ToneWarmth
    detail: ToneDetail


# ── System prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the PTM AI Agent for Super Sheldon / Sheldon Labs.
Generate a detailed, parent-friendly progress report as valid JSON.
The report should be comprehensive enough to fill 2–3 printed pages when rendered.

Rules:
- Use only the data provided in the user message.
- Where data is sparse or missing, make clearly conservative, positive assumptions.
- Set "inferred": true on any section you had to infer or assume.
- Collect all inferred section names in "_inferred_fields" array.
- Use full sentences. Be specific — name topics, give examples from the sessions.
- student_performance.narrative: minimum 3–4 sentences covering overall progress.
- strengths.items: 3–4 concrete strengths observed across sessions.
- growth_areas.items: 2–3 areas phrased constructively (not as failures — as next steps).
- homework_and_effort.narrative: 2–3 sentences on effort, consistency, attitude.
- milestone_of_month.description: 2–3 sentences celebrating a specific achievement.
- parent_action_items.items: 3 specific, actionable things parents can do at home.
- recommended_resources.items: 2–3 real resources (book, app, YouTube channel, worksheet type) relevant to subject and level. **Each item is a SINGLE PLAIN STRING** (e.g. "Khan Academy — algebra videos"), NOT an object.
- encouragement_message: 3–4 warm sentences addressed directly to the parents.
- at_home_action_plan.items: 4–6 concrete parent / student actions, each tagged by category.
- audio_script: a 45–60 second voice summary script (~120–160 words) for parents.
- Output ONLY raw JSON — no markdown, no code fences, no explanation.

CONFIDENCE SCORING (`ai_confidence`):
Score (0–100) how confident YOU (the agent) are in each part of the report.
Use these heuristics:
  - 85–100: directly stated in transcripts/summaries multiple times
  - 60–84:  inferred from clear signals (single explicit observation OR consistent indirect)
  - 40–59:  inferred from sparse signals
  - 0–39:   limited or no data; mostly conservative assumption
Inferred sections must score lower. Per-section sub-scores cover:
  attendance · engagement · academic_understanding · homework_consistency · communication
The overall score is a weighted average — round to integer.

EVIDENCE (`_evidence`):
For every section listed in `_inferred_fields`, include an array of evidence objects
in `_evidence[<section_name>]`. Each evidence object:
  { "type": "transcript" | "teacher_override" | "attendance_data" | "session_summary",
    "session_date": "YYYY-MM-DD" | null,
    "session_id": string | null,
    "snippet": "≤140-char quoted/paraphrased excerpt that supports this section" }

AT-HOME ACTION PLAN (`at_home_action_plan.items`):
Each item:
  { "title": "≤8-word imperative",
    "category": "practice" | "communication" | "confidence" | "study",
    "description": "1–2 sentences, parent-friendly, age-appropriate",
    "icon": "book" | "message-circle" | "sparkles" | "target" | "users" | "heart" }

Output schema (return exactly this structure):
{
  "header": { "student_name": "", "subject": "", "teacher_name": "", "reporting_period": "" },
  "sessions_attendance": { "total_classes": 0, "attendance_pct": 0, "no_shows": 0 },
  "learning_coverage": { "topics": [], "inferred": false },
  "student_performance": { "narrative": "", "inferred": false },
  "confidence_trend": { "level": "growing", "observations": "", "inferred": false },
  "strengths": { "items": [], "inferred": false },
  "growth_areas": { "items": [], "inferred": false },
  "homework_and_effort": { "narrative": "", "inferred": false },
  "milestone_of_month": { "title": "", "description": "", "inferred": false },
  "parent_action_items": { "items": [], "inferred": false },
  "next_steps": { "topics": [], "inferred": false },
  "recommended_resources": { "items": [], "inferred": false },
  "encouragement_message": "",
  "teacher_note": null,
  "at_home_action_plan": { "items": [], "inferred": false },
  "audio_script": "",
  "ai_confidence": {
    "overall": 0,
    "sections": {
      "attendance": 0,
      "engagement": 0,
      "academic_understanding": 0,
      "homework_consistency": 0,
      "communication": 0
    }
  },
  "_inferred_fields": [],
  "_evidence": {}
}

confidence_trend.level must be one of: "growing", "steady", "needs_support"."""


# ── Tone instructions ────────────────────────────────────────────────────────

_WARMTH_GUIDE = {
    "warm": "Use warm, encouraging, parent-friendly language. Address the parent personally where natural. Celebrate progress.",
    "balanced": "Use clear, professional, parent-friendly language with a positive but measured tone.",
    "formal": "Use precise, professional language. Avoid colloquialisms. Maintain a respectful, formal register suitable for a school report.",
}

_DETAIL_GUIDE = {
    "concise": "Keep narratives tight (2–3 sentences). Bullet lists max 3 items. Total report length should be brief and scannable.",
    "balanced": "Use the default lengths from the schema rules.",
    "detailed": "Lengthen narratives to 5–6 sentences with specific examples. Bullet lists may have up to 5 items each. Audio script may extend to 75 seconds.",
}


def _tone_block(tone: ToneOptions | None) -> str:
    if not tone:
        return ""
    warmth = tone.get("warmth", "balanced")
    detail = tone.get("detail", "balanced")
    return (
        "\n\nTONE CONTROLS:\n"
        f"- Warmth ({warmth}): {_WARMTH_GUIDE.get(warmth, _WARMTH_GUIDE['balanced'])}\n"
        f"- Detail ({detail}): {_DETAIL_GUIDE.get(detail, _DETAIL_GUIDE['balanced'])}"
    )


# ── User prompt ──────────────────────────────────────────────────────────────

def _build_user_prompt(data: dict, overrides: dict | None, tone: ToneOptions | None) -> str:
    summaries_text = "\n".join(f"- {s}" for s in data.get("summaries", []))
    dates_text = ", ".join(data.get("session_dates", [])) if data.get("session_dates") else "not provided"
    feedback_text = json.dumps(data.get("feedback", {}), indent=2) if data.get("feedback") else "None provided"

    override_text = ""
    if overrides:
        override_text = (
            "\n\nTeacher corrections / extra context (treat as authoritative — override your inference):\n"
            f"{json.dumps(overrides, indent=2)}"
        )

    return (
        f"Student: {data['name']}, {data.get('grade', '')}, Subject: {data['subject']}\n"
        f"Teacher: {data['teacher_name']}\n"
        f"Reporting period: {data['month']}\n"
        f"Session dates covered: {dates_text}\n"
        f"Classes included in this report: {data['total_classes']}, "
        f"Attendance: {data['attendance_pct']}%, No-shows: {data['no_shows']}\n\n"
        "Session summaries / transcripts (primary input — use these to extract topics, performance, "
        f"strengths, and observations):\n{summaries_text}\n\n"
        f"Optional teacher feedback fields (bonus signal):\n{feedback_text}"
        f"{override_text}{_tone_block(tone)}"
    )


# ── Public ────────────────────────────────────────────────────────────────────

async def generate_report(
    data: dict,
    overrides: dict | None = None,
    tone: ToneOptions | None = None,
) -> dict:
    if os.getenv("GEMINI_API_KEY", "").strip():
        return await _generate_real(data, overrides, tone)
    return _generate_mock(data, overrides, tone)


async def _generate_real(
    data: dict,
    overrides: dict | None,
    tone: ToneOptions | None,
) -> dict:
    import google.generativeai as genai
    from google.api_core.exceptions import GoogleAPIError, ResourceExhausted
    from fastapi import HTTPException

    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=SYSTEM_PROMPT,
        generation_config=genai.GenerationConfig(
            temperature=0.35,
            max_output_tokens=8192,
        ),
    )

    try:
        response = model.generate_content(_build_user_prompt(data, overrides, tone))
    except ResourceExhausted as e:
        # 429 — Gemini quota / per-minute rate limit. Surface a typed status
        # so the frontend can render a friendly toast instead of a raw 500.
        raise HTTPException(
            status_code=429,
            detail="AI quota reached. Please try again in a minute, or contact admin if this keeps happening.",
        ) from e
    except GoogleAPIError as e:
        # Any other Gemini-side failure (auth, invalid arg, transport).
        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {type(e).__name__}",
        ) from e
    raw = response.text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    parsed = json.loads(raw)
    return _ensure_phase1_fields(parsed, data, overrides)


# ── Mock generator ───────────────────────────────────────────────────────────

def _generate_mock(
    data: dict,
    overrides: dict | None,
    tone: ToneOptions | None,
) -> dict:
    name = data["name"]
    first = name.split()[0]
    subject = data["subject"]
    teacher = data["teacher_name"]
    month = data["month"]
    summaries = data.get("summaries", [])
    session_dates = data.get("session_dates", [])

    topics = []
    for s in summaries:
        topic = s.split("—")[0].split(".")[0].strip()
        if topic and topic not in topics:
            topics.append(topic)
    if not topics:
        topics = [
            f"{subject} core concepts",
            "Practice exercises",
            "Problem solving",
            "Revision & consolidation",
        ]

    detail = (tone or {}).get("detail", "balanced")
    warmth = (tone or {}).get("warmth", "balanced")
    is_concise = detail == "concise"
    is_formal = warmth == "formal"
    addr = "Dear parent" if is_formal else "Hi"

    perf_narrative = (
        f"{name} has shown consistent effort and growing engagement throughout this reporting period. "
        f"Sessions focused on key {subject} concepts, with {first} demonstrating a positive attitude towards learning. "
        f"There has been noticeable improvement in {first}'s ability to approach problems independently, "
        f"and the overall trajectory is encouraging. Continued practice will consolidate this progress further."
    )
    if is_concise:
        perf_narrative = (
            f"{first} is engaged and improving in {subject}. Independence on problems is rising. "
            f"Continued practice will lock in this progress."
        )

    confidence_obs = (
        f"{first} is increasingly willing to attempt problems before asking for help, "
        f"which is a strong indicator of growing confidence. In earlier sessions, prompting was often needed; "
        f"more recently, {first} has been initiating solutions independently."
    )

    audio_script = (
        f"{addr}, here is {first}'s {subject} update for this period. {first} attended "
        f"{data.get('total_classes', 0)} sessions with an attendance of {data.get('attendance_pct', 0)} percent. "
        f"This month {first} worked through {topics[0].lower()} and several practice problems, showing growing "
        f"independence. Areas to keep an eye on are speed and consistent at-home practice. We recommend short, "
        f"daily review sessions of 15 minutes. Thank you for your continued partnership."
    )

    inferred_fields = [
        "student_performance", "confidence_trend", "strengths", "growth_areas",
        "homework_and_effort", "milestone_of_month", "parent_action_items",
        "next_steps", "recommended_resources", "at_home_action_plan",
    ] if not summaries else [
        "student_performance", "strengths", "growth_areas",
        "homework_and_effort", "parent_action_items", "next_steps", "at_home_action_plan",
    ]

    # Evidence — synthesize from summaries
    def _evidence_for(section: str) -> list[dict]:
        ev = []
        for i, s in enumerate(summaries[:3]):
            ev.append({
                "type": "transcript",
                "session_date": session_dates[i] if i < len(session_dates) else None,
                "session_id": data.get("session_ids", [None] * len(summaries))[i] if data.get("session_ids") else None,
                "snippet": s[:140],
            })
        if overrides and section in {"student_performance", "homework_and_effort", "next_steps"}:
            for key, val in overrides.items():
                if isinstance(val, str) and val.strip():
                    ev.append({
                        "type": "teacher_override",
                        "session_date": None,
                        "session_id": None,
                        "snippet": f"{key}: {val[:120]}",
                    })
                    break
        return ev or [{
            "type": "session_summary",
            "session_date": None,
            "session_id": None,
            "snippet": "No transcript available — inference based on subject and grade norms.",
        }]

    evidence = {f: _evidence_for(f) for f in inferred_fields}

    # Confidence — penalize inferred sections
    has_summaries = len(summaries) > 0
    base = 78 if has_summaries else 48
    overall = base if not overrides else min(95, base + 8)
    sections = {
        "attendance": 100 if data.get("attendance_pct", 0) >= 0 else 50,
        "engagement": 70 if has_summaries else 45,
        "academic_understanding": 75 if has_summaries else 50,
        "homework_consistency": 60 if has_summaries else 40,
        "communication": 80 if has_summaries else 55,
    }

    return _ensure_phase1_fields({
        "header": {
            "student_name": name,
            "subject": subject,
            "teacher_name": teacher,
            "reporting_period": month,
        },
        "sessions_attendance": {
            "total_classes": data.get("total_classes", 0),
            "attendance_pct": data.get("attendance_pct", 0),
            "no_shows": data.get("no_shows", 0),
        },
        "learning_coverage": {"topics": topics, "inferred": not summaries},
        "student_performance": {"narrative": perf_narrative, "inferred": True},
        "confidence_trend": {
            "level": "growing",
            "observations": confidence_obs,
            "inferred": True,
        },
        "strengths": {
            "items": [
                f"Shows genuine curiosity and asks clarifying questions during {subject} sessions.",
                "Maintains a positive attitude even when topics are challenging.",
                "Demonstrates good retention of concepts introduced in previous sessions.",
                "Completes in-session exercises with focus and reasonable accuracy.",
            ][: 3 if is_concise else 4],
            "inferred": True,
        },
        "growth_areas": {
            "items": [
                f"Building speed and fluency in applying {subject} concepts under timed conditions.",
                "Developing the habit of checking work and self-correcting before seeking guidance.",
                "Strengthening independent problem-solving without prompting from the teacher.",
            ][: 2 if is_concise else 3],
            "inferred": True,
        },
        "homework_and_effort": {
            "narrative": (
                f"{first} demonstrates sincere effort during sessions and engages with the material thoughtfully. "
                f"Consistent practice between sessions will be key to accelerating progress. "
                f"Encouraging {first} to spend 15–20 minutes reviewing session notes at home would make a significant difference."
            ) if not is_concise else (
                f"{first} is engaged in sessions; 15 minutes of daily home review will accelerate progress."
            ),
            "inferred": True,
        },
        "milestone_of_month": {
            "title": f"Strong progress in {subject}",
            "description": (
                f"This period, {first} achieved a notable milestone by working through a set of practice problems "
                f"with significantly less guidance than before. This is a clear sign that the foundational concepts "
                f"are taking root and that {first} is ready to tackle more challenging material with confidence."
            ),
            "inferred": True,
        },
        "parent_action_items": {
            "items": [
                f"Set aside 15 minutes, 3–4 times a week, for {first} to review {subject} concepts covered in sessions.",
                f"Ask {first} to explain one thing they learned after each session — teaching reinforces learning.",
                "Encourage attempts at problems independently before seeking help — building that habit early is valuable.",
            ],
            "inferred": True,
        },
        "next_steps": {
            "topics": [
                f"Advance to the next level of {subject} concepts",
                "Timed practice to build speed and fluency",
                "Weekly self-assessment exercises",
                "Revisit any topics where consolidation is still needed",
            ][: 3 if is_concise else 4],
            "inferred": True,
        },
        "recommended_resources": {
            "items": [
                f"Khan Academy ({subject} section) — free, self-paced video lessons and exercises",
                "Revision worksheets provided by the teacher after each session",
                "BBC Bitesize — clear concept summaries and practice quizzes",
            ],
            "inferred": True,
        },
        "encouragement_message": (
            f"Thank you for your continued support in {first}'s learning journey. "
            f"The progress we are seeing is a result of both {first}'s hard work in sessions and the environment of "
            f"encouragement you provide at home. We are excited about the direction things are heading and look forward "
            f"to building on this momentum together. Please don't hesitate to reach out if you have any questions or "
            f"would like to discuss {first}'s progress further."
        ),
        "teacher_note": None,
        "at_home_action_plan": {
            "items": [
                {
                    "title": f"15-min {subject} review",
                    "category": "practice",
                    "icon": "book",
                    "description": f"3–4 evenings a week, have {first} re-do one problem covered in class.",
                },
                {
                    "title": f"Ask {first} to teach you",
                    "category": "communication",
                    "icon": "message-circle",
                    "description": "After each session, ask them to explain one concept aloud — teaching reinforces learning.",
                },
                {
                    "title": "Celebrate small wins",
                    "category": "confidence",
                    "icon": "sparkles",
                    "description": f"Acknowledge moments where {first} solved something independently — confidence compounds.",
                },
                {
                    "title": "Try-before-asking rule",
                    "category": "study",
                    "icon": "target",
                    "description": "Encourage one full attempt at a problem before seeking help. Build the habit gently.",
                },
                {
                    "title": "Tidy weekly study slot",
                    "category": "study",
                    "icon": "users",
                    "description": "Reserve a quiet 30-minute slot once a week for revision — predictability helps.",
                },
            ],
            "inferred": True,
        },
        "audio_script": audio_script,
        "ai_confidence": {"overall": overall, "sections": sections},
        "_inferred_fields": inferred_fields,
        "_evidence": evidence,
    }, data, overrides)


# ── Backfill helper ──────────────────────────────────────────────────────────

def _coerce_string(item) -> str:
    """Normalize Gemini's occasional object-vs-string drift into a single string."""
    if isinstance(item, str):
        return item
    if isinstance(item, dict):
        # Common shapes: {name, type, description}, {title, description}, {topic, ...}
        name = item.get("name") or item.get("title") or item.get("topic") or ""
        desc = item.get("description") or item.get("detail") or ""
        if name and desc:
            return f"{name} — {desc}"
        return name or desc or json.dumps(item, ensure_ascii=False)
    return str(item)


def _normalize_string_list(report: dict, path: tuple[str, ...]) -> None:
    """Ensure the value at `path` is a list[str]. Coerces objects/numbers to strings in place."""
    cur: object = report
    for key in path[:-1]:
        if not isinstance(cur, dict):
            return
        nxt = cur.get(key)
        if not isinstance(nxt, dict):
            return
        cur = nxt
    if not isinstance(cur, dict):
        return
    last = path[-1]
    raw = cur.get(last)
    if isinstance(raw, list):
        cur[last] = [_coerce_string(x) for x in raw if x is not None]


def _ensure_phase1_fields(report: dict, data: dict, overrides: dict | None) -> dict:
    """Defensive: fill in Phase-1 fields if Gemini omitted them or returned partials."""
    report.setdefault("at_home_action_plan", {"items": [], "inferred": True})
    report.setdefault("audio_script", "")
    report.setdefault("_inferred_fields", [])
    report.setdefault("_evidence", {})

    # Normalize string-list fields — Gemini occasionally returns dicts here
    for path in (
        ("learning_coverage", "topics"),
        ("strengths", "items"),
        ("growth_areas", "items"),
        ("parent_action_items", "items"),
        ("next_steps", "topics"),
        ("recommended_resources", "items"),
    ):
        _normalize_string_list(report, path)

    # at_home_action_plan items must be objects with title/category/icon/description
    plan = report.get("at_home_action_plan") or {}
    raw_items = plan.get("items") if isinstance(plan, dict) else None
    if isinstance(raw_items, list):
        normalized: list[dict] = []
        for it in raw_items:
            if isinstance(it, dict):
                normalized.append({
                    "title": str(it.get("title") or it.get("name") or "")[:80],
                    "category": _safe_category(it.get("category")),
                    "icon": _safe_icon(it.get("icon")),
                    "description": str(it.get("description") or it.get("detail") or ""),
                })
            elif isinstance(it, str):
                normalized.append({
                    "title": it[:80],
                    "category": "practice",
                    "icon": "book",
                    "description": "",
                })
        plan["items"] = normalized
        report["at_home_action_plan"] = plan

    ai = report.get("ai_confidence") or {}
    sections = ai.get("sections") or {}
    has_summaries = bool(data.get("summaries"))
    sections.setdefault("attendance", 100 if data.get("attendance_pct") is not None else 50)
    sections.setdefault("engagement", 70 if has_summaries else 45)
    sections.setdefault("academic_understanding", 75 if has_summaries else 50)
    sections.setdefault("homework_consistency", 60 if has_summaries else 40)
    sections.setdefault("communication", 80 if has_summaries else 55)
    overall = ai.get("overall")
    if not isinstance(overall, int):
        overall = round(sum(sections.values()) / max(1, len(sections)))
    report["ai_confidence"] = {"overall": int(overall), "sections": {k: int(v) for k, v in sections.items()}}

    # Ensure each inferred field has at least a stub evidence array
    inferred = report.get("_inferred_fields") or []
    evidence = report.get("_evidence") or {}
    for f in inferred:
        if f not in evidence or not isinstance(evidence[f], list) or not evidence[f]:
            evidence[f] = [{
                "type": "session_summary",
                "session_date": None,
                "session_id": None,
                "snippet": "Inferred from limited signals — verify with your own observation.",
            }]
    report["_evidence"] = evidence
    return report


_VALID_CATEGORIES = {"practice", "communication", "confidence", "study"}
_VALID_ICONS = {"book", "message-circle", "sparkles", "target", "users", "heart"}


def _safe_category(v) -> str:
    s = str(v or "").strip().lower()
    return s if s in _VALID_CATEGORIES else "practice"


def _safe_icon(v) -> str:
    s = str(v or "").strip().lower()
    return s if s in _VALID_ICONS else "book"
