"""
Creates tables and seeds the same 5 mock reports as the frontend mock-data.ts.
Idempotent — safe to re-run (INSERT OR IGNORE).
"""

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from db.connection import run_migrations, get_db

REPORTS = [
    {
        "id": "report-001",
        "student_id": "stu-001",
        "teacher_id": "tea-001",
        "student_name": "Arjun Mehta",
        "subject": "Mathematics",
        "reporting_month": "2026-05-01",
        "status": "pending",
        "regeneration_count": 0,
        "created_at": "2026-05-05T06:00:00+00:00",
        "updated_at": "2026-05-05T06:00:00+00:00",
        "draft_content": {
            "header": {"student_name": "Arjun Mehta", "subject": "Mathematics", "teacher_name": "Ms. Priya Sharma", "reporting_month": "May 2026"},
            "sessions_attendance": {"total_classes": 8, "attendance_pct": 87, "no_shows": 1},
            "learning_coverage": {"topics": ["Quadratic equations — factoring method", "Completing the square", "Discriminant and nature of roots", "Word problems using quadratics"], "inferred": False},
            "student_performance": {"narrative": "Arjun has shown strong engagement this month, actively participating when prompted. He demonstrated solid understanding of factoring and completing the square. Application to word problems is still developing — he would benefit from additional practice solving problems independently.", "inferred": True},
            "next_steps": {"topics": ["Quadratic formula", "Graphing parabolas", "Introduction to polynomials"], "inferred": True},
            "teacher_note": None,
            "_inferred_fields": ["student_performance", "next_steps"],
        },
    },
    {
        "id": "report-002",
        "student_id": "stu-002",
        "teacher_id": "tea-001",
        "student_name": "Sneha Iyer",
        "subject": "English",
        "reporting_month": "2026-05-01",
        "status": "pending",
        "regeneration_count": 0,
        "created_at": "2026-05-07T02:00:00+00:00",
        "updated_at": "2026-05-07T02:00:00+00:00",
        "draft_content": {
            "header": {"student_name": "Sneha Iyer", "subject": "English", "teacher_name": "Ms. Priya Sharma", "reporting_month": "May 2026"},
            "sessions_attendance": {"total_classes": 8, "attendance_pct": 100, "no_shows": 0},
            "learning_coverage": {"topics": ["Descriptive writing — sensory details", "Paragraph structuring (PEEL method)", "Vocabulary in context", "Reading comprehension strategies"], "inferred": False},
            "student_performance": {"narrative": "Sneha has been highly engaged throughout the month, asking thoughtful questions and contributing actively to discussions. She has mastered descriptive writing with strong use of sensory language. Her reading comprehension is excellent.", "inferred": False},
            "next_steps": {"topics": ["Analytical essay structure", "Persuasive writing techniques", "Advanced vocabulary — idioms and phrases"], "inferred": False},
            "teacher_note": None,
            "_inferred_fields": [],
        },
    },
    {
        "id": "report-003",
        "student_id": "stu-003",
        "teacher_id": "tea-001",
        "student_name": "Rohan Kapoor",
        "subject": "Coding",
        "reporting_month": "2026-05-01",
        "status": "approved",
        "regeneration_count": 0,
        "created_at": "2026-05-05T06:00:00+00:00",
        "updated_at": "2026-05-05T18:00:00+00:00",
        "draft_content": {
            "header": {"student_name": "Rohan Kapoor", "subject": "Coding", "teacher_name": "Ms. Priya Sharma", "reporting_month": "May 2026"},
            "sessions_attendance": {"total_classes": 8, "attendance_pct": 75, "no_shows": 2},
            "learning_coverage": {"topics": ["Python functions and scope", "Lists and list operations", "For loops and while loops", "Mini project: number guessing game"], "inferred": False},
            "student_performance": {"narrative": "Rohan demonstrated a solid grasp of Python functions and loops, solving most practice problems with light guidance. He completed the number guessing game project independently — a great achievement.", "inferred": False},
            "next_steps": {"topics": ["Dictionaries and sets", "File I/O basics", "Introduction to OOP"], "inferred": False},
            "teacher_note": "Rohan has been putting in great effort — proud of his progress!",
            "_inferred_fields": [],
        },
    },
    {
        "id": "report-004",
        "student_id": "stu-004",
        "teacher_id": "tea-001",
        "student_name": "Meera Nair",
        "subject": "Mathematics",
        "reporting_month": "2026-05-01",
        "status": "delivered",
        "regeneration_count": 1,
        "created_at": "2026-05-04T06:00:00+00:00",
        "updated_at": "2026-05-06T06:00:00+00:00",
        "draft_content": {
            "header": {"student_name": "Meera Nair", "subject": "Mathematics", "teacher_name": "Ms. Priya Sharma", "reporting_month": "May 2026"},
            "sessions_attendance": {"total_classes": 8, "attendance_pct": 87, "no_shows": 1},
            "learning_coverage": {"topics": ["Geometry — lines and angles", "Triangle properties", "Pythagoras theorem"], "inferred": False},
            "student_performance": {"narrative": "Meera showed strong independent understanding of triangle properties and Pythagoras theorem. She consistently solved practice problems independently.", "inferred": False},
            "next_steps": {"topics": ["Geometric proofs", "Circles and arcs", "Area and perimeter"], "inferred": False},
            "teacher_note": None,
            "_inferred_fields": [],
        },
    },
    {
        "id": "report-005",
        "student_id": "stu-005",
        "teacher_id": "tea-002",
        "student_name": "Dev Patel",
        "subject": "Chess",
        "reporting_month": "2026-05-01",
        "status": "escalated",
        "regeneration_count": 2,
        "created_at": "2026-05-02T06:00:00+00:00",
        "updated_at": "2026-05-05T06:00:00+00:00",
        "draft_content": {
            "header": {"student_name": "Dev Patel", "subject": "Chess", "teacher_name": "Mr. Anil Kumar", "reporting_month": "May 2026"},
            "sessions_attendance": {"total_classes": 4, "attendance_pct": 75, "no_shows": 1},
            "learning_coverage": {"topics": ["Opening principles", "Tactics — pins and forks"], "inferred": True},
            "student_performance": {"narrative": "Dev is developing his tactical awareness. Will benefit from revisiting opening concepts.", "inferred": True},
            "next_steps": {"topics": ["Endgame basics", "Checkmate patterns"], "inferred": True},
            "teacher_note": None,
            "_inferred_fields": ["learning_coverage", "student_performance", "next_steps"],
        },
    },
]


async def seed():
    await run_migrations()
    db = await get_db()
    try:
        for r in REPORTS:
            await db.execute(
                """INSERT INTO ptm_reports
                   (id, student_id, teacher_id, student_name, subject, reporting_month,
                    status, draft_content, teacher_note, regeneration_count, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (id) DO NOTHING""",
                [
                    r["id"], r["student_id"], r["teacher_id"], r["student_name"],
                    r["subject"], r["reporting_month"], r["status"],
                    json.dumps(r["draft_content"]),
                    r["draft_content"].get("teacher_note"),
                    r["regeneration_count"], r["created_at"], r["updated_at"],
                ],
            )
        await db.commit()
        print(f"Seeded {len(REPORTS)} reports into ptm.db")
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(seed())
