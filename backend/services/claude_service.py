"""
Claude report generation service.
If ANTHROPIC_API_KEY is set → real Claude Sonnet 4.6 call with prompt caching.
If not set → returns a deterministic mock draft so the full flow works without a key.
"""

import json
import os

TRANSLATIONS = {
    "Distracted for most of the class": "Working on building consistent focus during sessions",
    "Needs significant reinforcement": "Will benefit from revisiting this concept in upcoming sessions",
    "Struggled with practice problems": "Building confidence with applying the concept independently",
    "Mastered the concept independently": "Demonstrating strong, independent grasp of the concept",
    "Understood with minimal guidance": "Showing confident understanding with light support",
    "Understood after multiple examples": "Building understanding steadily with structured examples",
    "Partially understood — needs revision": "Making progress — revisiting key concepts will help",
    "Solved practice problems independently": "Applying concepts independently with confidence",
    "Solved with light prompts": "Applying concepts well with occasional guidance",
    "Solved with substantial support": "Developing ability to apply concepts with support",
    "Did not attempt practice work": "Will benefit from more practice opportunities next month",
    "Highly engaged — asked questions and contributed actively": "Showing great enthusiasm and active participation",
    "Engaged — participated when prompted": "Participating actively during sessions",
    "Moderately engaged — some focus drift": "Working on sustaining focus throughout sessions",
    "Needed encouragement to stay engaged": "Building concentration and engagement during sessions",
}

SYSTEM_PROMPT = """You are the PTM AI Agent for Super Sheldon / Sheldon Labs.
Generate a 1-page parent-friendly monthly progress report as valid JSON.

Rules:
- Use only the data provided in the user message.
- Where data is sparse or missing, make clearly conservative, positive assumptions.
- Set "inferred": true on any section you had to infer or assume.
- Collect all inferred section names in "_inferred_fields" array.
- Use warm, encouraging, parent-friendly language. No jargon.
- Output ONLY raw JSON — no markdown, no code fences, no explanation.

Output schema (return exactly this structure):
{
  "header": {
    "student_name": "",
    "subject": "",
    "teacher_name": "",
    "reporting_month": ""
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
  "next_steps": {
    "topics": [],
    "inferred": false
  },
  "teacher_note": null,
  "_inferred_fields": []
}"""


def _build_user_prompt(data: dict, overrides: dict | None = None) -> str:
    summaries_text = "\n".join(f"- {s}" for s in data.get("summaries", []))
    feedback_text = json.dumps(data.get("feedback", {}), indent=2) if data.get("feedback") else "None provided"

    override_text = ""
    if overrides:
        override_text = f"\n\nTeacher corrections (treat as authoritative — override your inference):\n{json.dumps(overrides, indent=2)}"

    return f"""Student: {data['name']}, {data.get('grade', '')}, Subject: {data['subject']}
Teacher: {data['teacher_name']}
Reporting month: {data['month']}
Classes held: {data['total_classes']}, Attendance: {data['attendance_pct']}%, No-shows: {data['no_shows']}

Class summaries (primary input):
{summaries_text}

Optional teacher feedback fields (bonus signal, not required):
{feedback_text}{override_text}"""


async def generate_report(data: dict, overrides: dict | None = None) -> dict:
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if api_key:
        return await _generate_real(data, overrides)
    return _generate_mock(data)


async def _generate_real(data: dict, overrides: dict | None = None) -> dict:
    import anthropic

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {"role": "user", "content": _build_user_prompt(data, overrides)}
        ],
    )
    raw = response.content[0].text.strip()
    return json.loads(raw)


def _generate_mock(data: dict) -> dict:
    name = data["name"]
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
        topics = [f"{subject} core concepts", "Practice exercises", "Revision"]

    narrative = (
        f"{name} has shown consistent effort throughout {month}. "
        f"Sessions covered key {subject} concepts, and {name.split()[0]} demonstrated growing confidence. "
        f"Continued practice will help consolidate this progress."
    )

    return {
        "header": {
            "student_name": name,
            "subject": subject,
            "teacher_name": teacher,
            "reporting_month": month,
        },
        "sessions_attendance": {
            "total_classes": data.get("total_classes", 0),
            "attendance_pct": data.get("attendance_pct", 0),
            "no_shows": data.get("no_shows", 0),
        },
        "learning_coverage": {"topics": topics, "inferred": not summaries},
        "student_performance": {"narrative": narrative, "inferred": True},
        "next_steps": {
            "topics": [f"Continue {subject} practice", "Review previous topics", "Work on independent problem-solving"],
            "inferred": True,
        },
        "teacher_note": None,
        "_inferred_fields": ["student_performance", "next_steps"],
    }
