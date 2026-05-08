import type { ConfidenceSectionKey } from "@/app/lib/mock-data";

export type ConfidenceTier = "high" | "medium" | "low";

export const CONFIDENCE_TOOLTIP =
  "Confidence is based on transcript coverage, explicit observations, and inference usage.";

export function confidenceTier(score: number | null | undefined): ConfidenceTier {
  if (score == null) return "low";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function tierColor(tier: ConfidenceTier): {
  text: string;
  bg: string;
  border: string;
  bar: string;
  ring: string;
} {
  switch (tier) {
    case "high":
      return {
        text: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        bar: "bg-emerald-500",
        ring: "ring-emerald-200",
      };
    case "medium":
      return {
        text: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-200",
        bar: "bg-amber-500",
        ring: "ring-amber-200",
      };
    case "low":
      return {
        text: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-200",
        bar: "bg-red-500",
        ring: "ring-red-200",
      };
  }
}

export const SECTION_LABELS: Record<ConfidenceSectionKey, string> = {
  attendance: "Attendance",
  engagement: "Engagement",
  academic_understanding: "Academic Understanding",
  homework_consistency: "Homework Consistency",
  communication: "Communication",
};

export const SECTION_ORDER: ConfidenceSectionKey[] = [
  "attendance",
  "engagement",
  "academic_understanding",
  "homework_consistency",
  "communication",
];
