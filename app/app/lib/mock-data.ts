export type ReportStatus = "pending" | "approved" | "rejected" | "delivered" | "escalated";

export interface InferredField {
  field: string;
  inferred: boolean;
}

export interface ReportDraft {
  header: {
    student_name: string;
    subject: string;
    teacher_name: string;
    reporting_month: string;
  };
  sessions_attendance: {
    total_classes: number;
    attendance_pct: number;
    no_shows: number;
  };
  learning_coverage: {
    topics: string[];
    inferred: boolean;
  };
  student_performance: {
    narrative: string;
    inferred: boolean;
  };
  next_steps: {
    topics: string[];
    inferred: boolean;
  };
  teacher_note: string | null;
  _inferred_fields: string[];
}

export interface PTMReport {
  id: string;
  student_id: string;
  teacher_id: string;
  student_name: string;
  subject: string;
  reporting_month: string;
  status: ReportStatus;
  draft_content: ReportDraft;
  pdf_url: string | null;
  teacher_note: string | null;
  regeneration_count: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireQuestion {
  type: "dropdown_engagement" | "dropdown_concept" | "dropdown_application" | "topics_correction" | "next_month_plan" | "free_form";
  label: string;
  description?: string;
  options?: { value: number; label: string }[];
}

// ─── Mock Reports ───

export const MOCK_REPORTS: PTMReport[] = [
  {
    id: "report-001",
    student_id: "stu-001",
    teacher_id: "tea-001",
    student_name: "Arjun Mehta",
    subject: "Mathematics",
    reporting_month: "2026-05-01",
    status: "pending",
    regeneration_count: 0,
    created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), // 26h ago → triggers reminder
    updated_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    pdf_url: null,
    teacher_note: null,
    draft_content: {
      header: {
        student_name: "Arjun Mehta",
        subject: "Mathematics",
        teacher_name: "Ms. Priya Sharma",
        reporting_month: "May 2026",
      },
      sessions_attendance: {
        total_classes: 8,
        attendance_pct: 87,
        no_shows: 1,
      },
      learning_coverage: {
        topics: [
          "Quadratic equations — factoring method",
          "Completing the square",
          "Discriminant and nature of roots",
          "Word problems using quadratics",
        ],
        inferred: false,
      },
      student_performance: {
        narrative:
          "Arjun has shown strong engagement this month, actively participating when prompted. He demonstrated solid understanding of factoring and completing the square. Application to word problems is still developing — he would benefit from additional practice solving problems independently.",
        inferred: true,
      },
      next_steps: {
        topics: [
          "Quadratic formula",
          "Graphing parabolas",
          "Introduction to polynomials",
        ],
        inferred: true,
      },
      teacher_note: null,
      _inferred_fields: ["student_performance", "next_steps"],
    },
  },
  {
    id: "report-002",
    student_id: "stu-002",
    teacher_id: "tea-001",
    student_name: "Sneha Iyer",
    subject: "English",
    reporting_month: "2026-05-01",
    status: "pending",
    regeneration_count: 0,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4h ago — no reminder
    updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    pdf_url: null,
    teacher_note: null,
    draft_content: {
      header: {
        student_name: "Sneha Iyer",
        subject: "English",
        teacher_name: "Ms. Priya Sharma",
        reporting_month: "May 2026",
      },
      sessions_attendance: {
        total_classes: 8,
        attendance_pct: 100,
        no_shows: 0,
      },
      learning_coverage: {
        topics: [
          "Descriptive writing — sensory details",
          "Paragraph structuring (PEEL method)",
          "Vocabulary in context",
          "Reading comprehension strategies",
        ],
        inferred: false,
      },
      student_performance: {
        narrative:
          "Sneha has been highly engaged throughout the month, asking thoughtful questions and contributing actively to discussions. She has mastered descriptive writing with strong use of sensory language. Her reading comprehension is excellent — she would benefit from stretching into more complex analytical writing next.",
        inferred: false,
      },
      next_steps: {
        topics: [
          "Analytical essay structure",
          "Persuasive writing techniques",
          "Advanced vocabulary — idioms and phrases",
        ],
        inferred: false,
      },
      teacher_note: null,
      _inferred_fields: [],
    },
  },
  {
    id: "report-003",
    student_id: "stu-003",
    teacher_id: "tea-001",
    student_name: "Rohan Kapoor",
    subject: "Coding",
    reporting_month: "2026-05-01",
    status: "approved",
    regeneration_count: 0,
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    pdf_url: "/mock/rohan-kapoor-coding-may2026.pdf",
    teacher_note: "Rohan has been putting in great effort — proud of his progress!",
    draft_content: {
      header: {
        student_name: "Rohan Kapoor",
        subject: "Coding",
        teacher_name: "Ms. Priya Sharma",
        reporting_month: "May 2026",
      },
      sessions_attendance: {
        total_classes: 8,
        attendance_pct: 75,
        no_shows: 2,
      },
      learning_coverage: {
        topics: [
          "Python functions and scope",
          "Lists and list operations",
          "For loops and while loops",
          "Mini project: number guessing game",
        ],
        inferred: false,
      },
      student_performance: {
        narrative:
          "Rohan demonstrated a solid grasp of Python functions and loops, solving most practice problems with light guidance. He completed the number guessing game project independently — a great achievement. Building confidence with applying concepts across new problem types.",
        inferred: false,
      },
      next_steps: {
        topics: ["Dictionaries and sets", "File I/O basics", "Introduction to OOP"],
        inferred: false,
      },
      teacher_note: "Rohan has been putting in great effort — proud of his progress!",
      _inferred_fields: [],
    },
  },
  {
    id: "report-004",
    student_id: "stu-004",
    teacher_id: "tea-001",
    student_name: "Meera Nair",
    subject: "Mathematics",
    reporting_month: "2026-05-01",
    status: "delivered",
    regeneration_count: 1,
    created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    pdf_url: "/mock/meera-nair-maths-may2026.pdf",
    teacher_note: null,
    draft_content: {
      header: {
        student_name: "Meera Nair",
        subject: "Mathematics",
        teacher_name: "Ms. Priya Sharma",
        reporting_month: "May 2026",
      },
      sessions_attendance: {
        total_classes: 8,
        attendance_pct: 87,
        no_shows: 1,
      },
      learning_coverage: {
        topics: ["Geometry — lines and angles", "Triangle properties", "Pythagoras theorem"],
        inferred: false,
      },
      student_performance: {
        narrative:
          "Meera showed strong independent understanding of triangle properties and Pythagoras theorem. She consistently solved practice problems independently and is ready to tackle more advanced geometric proofs.",
        inferred: false,
      },
      next_steps: {
        topics: ["Geometric proofs", "Circles and arcs", "Area and perimeter"],
        inferred: false,
      },
      teacher_note: null,
      _inferred_fields: [],
    },
  },
];

// ─── Escalated reports ───
export const MOCK_ESCALATED: PTMReport[] = [
  {
    id: "report-005",
    student_id: "stu-005",
    teacher_id: "tea-002",
    student_name: "Dev Patel",
    subject: "Chess",
    reporting_month: "2026-05-01",
    status: "escalated",
    regeneration_count: 2,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    pdf_url: null,
    teacher_note: null,
    draft_content: {
      header: {
        student_name: "Dev Patel",
        subject: "Chess",
        teacher_name: "Mr. Anil Kumar",
        reporting_month: "May 2026",
      },
      sessions_attendance: { total_classes: 4, attendance_pct: 75, no_shows: 1 },
      learning_coverage: {
        topics: ["Opening principles", "Tactics — pins and forks"],
        inferred: true,
      },
      student_performance: {
        narrative: "Dev is developing his tactical awareness. Will benefit from revisiting opening concepts.",
        inferred: true,
      },
      next_steps: { topics: ["Endgame basics", "Checkmate patterns"], inferred: true },
      teacher_note: null,
      _inferred_fields: ["learning_coverage", "student_performance", "next_steps"],
    },
  },
];

// ─── Questionnaire questions (dynamic — only inferred fields) ───
export function getQuestionsForReport(report: PTMReport): QuestionnaireQuestion[] {
  const questions: QuestionnaireQuestion[] = [];
  const inferred = report.draft_content._inferred_fields;

  if (inferred.includes("student_performance")) {
    questions.push({
      type: "dropdown_engagement",
      label: "How engaged was this student during sessions?",
      description: "The agent inferred the engagement level from class summaries.",
      options: [
        { value: 1, label: "Highly engaged — asked questions and contributed actively" },
        { value: 2, label: "Engaged — participated when prompted" },
        { value: 3, label: "Moderately engaged — some focus drift" },
        { value: 4, label: "Needed encouragement to stay engaged" },
        { value: 5, label: "Distracted for most of the class" },
      ],
    });
    questions.push({
      type: "dropdown_concept",
      label: "How well did the student understand the concepts covered?",
      options: [
        { value: 1, label: "Mastered the concept independently" },
        { value: 2, label: "Understood with minimal guidance" },
        { value: 3, label: "Understood after multiple examples" },
        { value: 4, label: "Partially understood — needs revision" },
        { value: 5, label: "Needs significant reinforcement" },
      ],
    });
    questions.push({
      type: "dropdown_application",
      label: "How well did the student apply concepts in practice?",
      options: [
        { value: 1, label: "Solved practice problems independently" },
        { value: 2, label: "Solved with light prompts" },
        { value: 3, label: "Solved with substantial support" },
        { value: 4, label: "Struggled with practice problems" },
        { value: 5, label: "Did not attempt practice work" },
      ],
    });
  }

  if (inferred.includes("next_steps")) {
    questions.push({
      type: "next_month_plan",
      label: "What topics should this student focus on next month?",
      description: "Add up to 4 topics. The agent's suggestion: " +
        report.draft_content.next_steps.topics.join(", "),
    });
  }

  questions.push({
    type: "free_form",
    label: "Anything else the agent got wrong or missed?",
    description: "Optional — leave blank if everything else looks accurate.",
  });

  return questions;
}
