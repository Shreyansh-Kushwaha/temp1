"""
Mock Wise portal client.
Real implementation: replace get_student_month_data() body with an httpx call
to the Wise API — the interface stays identical.
"""

MOCK_STUDENTS = {
    "stu-001": {"name": "Arjun Mehta", "grade": "Grade 8", "teacher_name": "Ms. Priya Sharma", "teacher_id": "tea-001", "subject": "Mathematics"},
    "stu-002": {"name": "Sneha Iyer", "grade": "Grade 7", "teacher_name": "Ms. Priya Sharma", "teacher_id": "tea-001", "subject": "English"},
    "stu-003": {"name": "Rohan Kapoor", "grade": "Grade 9", "teacher_name": "Ms. Priya Sharma", "teacher_id": "tea-001", "subject": "Coding"},
    "stu-004": {"name": "Meera Nair", "grade": "Grade 8", "teacher_name": "Ms. Priya Sharma", "teacher_id": "tea-001", "subject": "Mathematics"},
    "stu-005": {"name": "Dev Patel", "grade": "Grade 6", "teacher_name": "Mr. Anil Kumar", "teacher_id": "tea-002", "subject": "Chess"},
}

MOCK_CLASS_DATA = {
    "stu-001": {
        "total_classes": 8, "attendance_pct": 87, "no_shows": 1,
        "summaries": [
            "Covered factoring of quadratic expressions. Arjun struggled initially but got it after a few examples.",
            "Completed the square method. Good participation today.",
            "Discussed discriminant and nature of roots. Student was attentive.",
            "Word problems with quadratics. Needs more practice with setting up equations.",
        ],
        "feedback": {},
    },
    "stu-002": {
        "total_classes": 8, "attendance_pct": 100, "no_shows": 0,
        "summaries": [
            "Descriptive writing with sensory details. Sneha produced excellent work.",
            "PEEL paragraph structure — student grasped it quickly and applied it well.",
            "Vocabulary in context exercises. Very strong performance.",
            "Reading comprehension strategies. Sneha asked great analytical questions.",
        ],
        "feedback": {"engagement": "Highly engaged", "concept": "Mastered the concept independently"},
    },
    "stu-003": {
        "total_classes": 8, "attendance_pct": 75, "no_shows": 2,
        "summaries": [
            "Python functions and scope — Rohan completed all exercises.",
            "Lists and list operations. Good understanding.",
            "For loops and while loops. Completed independently.",
            "Mini project: number guessing game. Rohan finished it on his own — great achievement.",
        ],
        "feedback": {},
    },
    "stu-004": {
        "total_classes": 8, "attendance_pct": 87, "no_shows": 1,
        "summaries": [
            "Geometry: lines and angles. Meera answered all questions correctly.",
            "Triangle properties — excellent grasp.",
            "Pythagoras theorem — solved problems independently.",
        ],
        "feedback": {"engagement": "Highly engaged", "concept": "Mastered the concept independently"},
    },
    "stu-005": {
        "total_classes": 4, "attendance_pct": 75, "no_shows": 1,
        "summaries": [
            "Opening principles — student showed interest.",
            "Tactics: pins and forks.",
        ],
        "feedback": {},
    },
}


async def get_student_month_data(student_id: str, month: str) -> dict | None:
    student = MOCK_STUDENTS.get(student_id)
    if not student:
        return None
    class_data = MOCK_CLASS_DATA.get(student_id, {})
    return {**student, **class_data, "month": month}


async def list_active_students(month: str) -> list[dict]:
    return [
        {"student_id": sid, **MOCK_STUDENTS[sid], "month": month}
        for sid in MOCK_STUDENTS
    ]
