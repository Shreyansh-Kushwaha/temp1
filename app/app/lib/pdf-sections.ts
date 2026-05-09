/**
 * Single source of truth for which sections of a report can be included in the
 * PDF render and the order they appear. Keys are referenced from:
 *   - PrintEditor.tsx              → conditional rendering + ordering
 *   - PdfSectionsPanel.tsx         → toggle UI on the preview page
 *   - draft_content._pdf_hidden_sections   → array of keys the teacher hid
 */

import type { ReportDraft } from "./mock-data";

export interface PdfSection {
  key: string;
  label: string;
  description: string;
  /** Page 1 sections render before the (optional) forced page break. */
  page: 1 | 2;
  /** Optional predicate — if it returns false, the section can't be toggled
   *  (e.g. report has no growth_areas data, so showing the toggle would be misleading). */
  available?: (d: ReportDraft) => boolean;
}

export const PDF_SECTIONS: PdfSection[] = [
  {
    key: "sessions_attendance",
    label: "Sessions & Attendance",
    description: "Classes conducted, attendance %, no-shows.",
    page: 1,
  },
  {
    key: "learning_coverage",
    label: "Learning Coverage",
    description: "Topics covered this month.",
    page: 1,
    available: (d) => (d.learning_coverage?.topics?.length ?? 0) > 0,
  },
  {
    key: "student_performance",
    label: "Overall Performance",
    description: "Narrative on how the student performed.",
    page: 1,
    available: (d) => !!d.student_performance?.narrative,
  },
  {
    key: "at_home_action_plan",
    label: "At-Home Action Plan",
    description: "Concrete things parents can do at home.",
    page: 1,
    available: (d) => (d.at_home_action_plan?.items?.length ?? 0) > 0,
  },
  {
    key: "next_steps",
    label: "Next Steps",
    description: "Topics planned for next month.",
    page: 1,
    available: (d) => (d.next_steps?.topics?.length ?? 0) > 0,
  },
  {
    key: "strengths",
    label: "Key Strengths",
    description: "Things the student is doing well.",
    page: 2,
    available: (d) => (d.strengths?.items?.length ?? 0) > 0,
  },
  {
    key: "growth_areas",
    label: "Areas to Grow",
    description: "Where the student needs more focus.",
    page: 2,
    available: (d) => (d.growth_areas?.items?.length ?? 0) > 0,
  },
  {
    key: "homework_and_effort",
    label: "Homework & Effort",
    description: "How the student is approaching practice work.",
    page: 2,
    available: (d) => !!d.homework_and_effort?.narrative,
  },
  {
    key: "milestone_of_month",
    label: "Milestone of the Month",
    description: "A standout achievement worth celebrating.",
    page: 2,
    available: (d) => !!d.milestone_of_month?.title,
  },
  {
    key: "recommended_resources",
    label: "Recommended Resources",
    description: "Books, videos, or activities to try.",
    page: 2,
    available: (d) => (d.recommended_resources?.items?.length ?? 0) > 0,
  },
  {
    key: "encouragement_message",
    label: "Encouragement Message",
    description: "A short note of encouragement for the student.",
    page: 2,
    available: (d) => !!d.encouragement_message,
  },
  {
    key: "teacher_note",
    label: "Teacher's Note",
    description: "The teacher's personal closing note.",
    page: 2,
  },
];

export function isPdfSectionShown(
  hiddenList: string[] | undefined,
  key: string
): boolean {
  return !(hiddenList ?? []).includes(key);
}
