"""
Report generation service — Gemini 2.5 Flash.
If GEMINI_API_KEY is set → real Gemini call.
If not set → returns a deterministic mock draft so the full flow works without a key.
"""

import json
import os

SYSTEM_PROMPT = """You are the PTM AI Agent for Super Sheldon / Sheldon Labs.
Generate a detailed, parent-friendly progress report as valid JSON.
The report should be comprehensive enough to fill 2–3 printed pages when rendered.

Rules:
- Use only the data provided in the user message.
- Where data is sparse or missing, make clearly conservative, positive assumptions.
- Set "inferred": true on any section you had to infer or assume.
- Collect all inferred section names in "_inferred_fields" array.
- Use warm, encouraging, parent-friendly language. No jargon.
- Write in full sentences. Be specific — name topics, give examples from the sessions.
- student_performance.narrative: minimum 3–4 sentences covering overall progress.
- strengths.items: 3–4 concrete strengths observed across sessions.
- growth_areas.items: 2–3 areas phrased constructively (not as failures — as next steps).
- homework_and_effort.narrative: 2–3 sentences on effort, consistency, attitude.
- milestone_of_month.description: 2–3 sentences celebrating a specific achievement.
- parent_action_items.items: 3 specific, actionable things parents can do at home.
- recommended_resources.items: 2–3 real resources (book, app, YouTube channel, worksheet type) relevant to subject and level.
- encouragement_message: 3–4 warm sentences addressed directly to the parents.
- Output ONLY raw JSON — no markdown, no code fences, no explanation.

Output schema (return exactly this structure):
{
  "header": {
    "student_name": "",
    "subject": "",
    "teacher_name": "",
    "reporting_period": ""
  },
  "sessions_attendance": {
    "total_classes": 0,
    "attendance_pct": 0,
    "no_shows": 0
  },
  "learning_coverage": {
    "topics": [],
    "inferred": false
  },
  "student_performance": {
    "narrative": "",
    "inferred": false
  },
  "confidence_trend": {
    "level": "growing",
    "observations": "",
    "inferred": false
  },
  "strengths": {
    "items": [],
    "inferred": false
  },
  "growth_areas": {
    "items": [],
    "inferred": false
  },
  "homework_and_effort": {
    "narrative": "",
    "inferred": false
  },
  "milestone_of_month": {
    "title": "",
    "description": "",
    "inferred": false
  },
  "parent_action_items": {
    "items": [],
    "inferred": false
  },
  "next_steps": {
    "topics": [],
    "inferred": false
  },
  "recommended_resources": {
    "items": [],
    "inferred": false
  },
  "encouragement_message": "",
  "teacher_note": null,
  "_inferred_fields": []
}

confidence_trend.level must be one of: "growing", "steady", "needs_support"."""


def _build_user_prompt(data: dict, overrides: dict | None = None) -> str:
    summaries_text = "\n".join(f"- {s}" for s in data.get("summaries", []))
    dates_text = ", ".join(data.get("session_dates", [])) if data.get("session_dates") else "not provided"
    feedback_text = json.dumps(data.get("feedback", {}), indent=2) if data.get("feedback") else "None provided"

    override_text = ""
    if overrides:
        override_text = f"\n\nTeacher corrections / extra context (treat as authoritative — override your inference):\n{json.dumps(overrides, indent=2)}"

    return f"""Student: {data['name']}, {data.get('grade', '')}, Subject: {data['subject']}
Teacher: {data['teacher_name']}
Reporting period: {data['month']}
Session dates covered: {dates_text}
Classes included in this report: {data['total_classes']}, Attendance: {data['attendance_pct']}%, No-shows: {data['no_shows']}

Session summaries / transcripts (primary input — use these to extract topics, performance, strengths, and observations):
{summaries_text}

Optional teacher feedback fields (bonus signal):
{feedback_text}{override_text}"""


async def generate_report(data: dict, overrides: dict | None = None) -> dict:
    if os.getenv("GEMINI_API_KEY", "").strip():
        return await _generate_real(data, overrides)
    return _generate_mock(data)


async def _generate_real(data: dict, overrides: dict | None = None) -> dict:
    import google.generativeai as genai

    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=SYSTEM_PROMPT,
        generation_config=genai.GenerationConfig(
            temperature=0.35,
            max_output_tokens=8192,
        ),
    )

    response = model.generate_content(_build_user_prompt(data, overrides))
    raw = response.text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)


def _generate_mock(data: dict) -> dict:
    name = data["name"]
    first = name.split()[0]
    subject = data["subject"]
    teacher = data["teacher_name"]
    month = data["month"]
    summaries = data.get("summaries", [])

    topics = []
    for s in summaries:
        topic = s.split("—")[0].split(".")[0].strip()
        if topic and topic not in topics:
            topics.append(topic)
    if not topics:
        topics = [f"{subject} core concepts", "Practice exercises", "Problem solving", "Revision & consolidation"]

    return {
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
        "student_performance": {
            "narrative": (
                f"{name} has shown consistent effort and growing engagement throughout this reporting period. "
                f"Sessions focused on key {subject} concepts, with {first} demonstrating a positive attitude towards learning. "
                f"There has been noticeable improvement in {first}'s ability to approach problems independently, "
                f"and the overall trajectory is encouraging. Continued practice will consolidate this progress further."
            ),
            "inferred": True,
        },
        "confidence_trend": {
            "level": "growing",
            "observations": (
                f"{first} is increasingly willing to attempt problems before asking for help, "
                f"which is a strong indicator of growing confidence. In earlier sessions, prompting was often needed; "
                f"more recently, {first} has been initiating solutions independently."
            ),
            "inferred": True,
        },
        "strengths": {
            "items": [
                f"Shows genuine curiosity and asks clarifying questions during {subject} sessions.",
                "Maintains a positive attitude even when topics are challenging.",
                "Demonstrates good retention of concepts introduced in previous sessions.",
                "Completes in-session exercises with focus and reasonable accuracy.",
            ],
            "inferred": True,
        },
        "growth_areas": {
            "items": [
                f"Building speed and fluency in applying {subject} concepts under timed conditions.",
                "Developing the habit of checking work and self-correcting before seeking guidance.",
                "Strengthening independent problem-solving without prompting from the teacher.",
            ],
            "inferred": True,
        },
        "homework_and_effort": {
            "narrative": (
                f"{first} demonstrates sincere effort during sessions and engages with the material thoughtfully. "
                f"Consistent practice between sessions will be key to accelerating progress. "
                f"Encouraging {first} to spend 15–20 minutes reviewing session notes at home would make a significant difference."
            ),
            "inferred": True,
        },
        "milestone_of_month": {
            "title": f"Strong progress in {subject}",
            "description": (
                f"This period, {first} achieved a notable milestone by working through a set of practice problems with "
                f"significantly less guidance than before. This is a clear sign that the foundational concepts are taking root "
                f"and that {first} is ready to tackle more challenging material with confidence."
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
            ],
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
            f"The progress we are seeing is a result of both {first}'s hard work in sessions and the environment of encouragement you provide at home. "
            f"We are excited about the direction things are heading and look forward to building on this momentum together. "
            f"Please don't hesitate to reach out if you have any questions or would like to discuss {first}'s progress further."
        ),
        "teacher_note": None,
        "_inferred_fields": [
            "student_performance", "confidence_trend", "strengths", "growth_areas",
            "homework_and_effort", "milestone_of_month", "parent_action_items",
            "next_steps", "recommended_resources",
        ],
    }
