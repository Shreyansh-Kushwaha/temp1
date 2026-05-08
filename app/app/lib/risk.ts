import type { RiskSeverity, RiskSignalType } from "@/app/lib/mock-data";

export const SIGNAL_LABEL: Record<RiskSignalType, string> = {
  attendance_drop: "Attendance drop",
  confidence_decline: "Confidence decline",
  engagement_drop: "Engagement drop",
  recurring_weakness: "Recurring weakness",
  homework_inconsistency: "Homework inconsistency",
  burnout: "Burnout indicator",
};

export const SEVERITY_META: Record<
  RiskSeverity,
  { label: string; bg: string; border: string; text: string; bar: string }
> = {
  high: {
    label: "High",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    bar: "bg-red-500",
  },
  medium: {
    label: "Medium",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    bar: "bg-amber-500",
  },
  low: {
    label: "Low",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    bar: "bg-blue-500",
  },
};

export const SEVERITY_RANK: Record<RiskSeverity, number> = { high: 3, medium: 2, low: 1 };
