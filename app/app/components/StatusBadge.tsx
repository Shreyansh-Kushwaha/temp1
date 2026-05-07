import type { ReportStatus } from "@/app/lib/mock-data";

const config: Record<
  ReportStatus,
  { label: string; pill: string; dot: string; pulse: boolean }
> = {
  pending: {
    label: "Pending",
    pill: "bg-[var(--ss-o-50)] text-[var(--ss-o-700)] border border-[var(--ss-o-200)]",
    dot: "bg-[var(--ss-o-500)]",
    pulse: true,
  },
  approved: {
    label: "Approved",
    pill: "bg-green-50 text-green-700 border border-green-200",
    dot: "bg-green-500",
    pulse: false,
  },
  rejected: {
    label: "Rejected",
    pill: "bg-amber-50 text-amber-700 border border-amber-200",
    dot: "bg-amber-500",
    pulse: false,
  },
  delivered: {
    label: "Delivered",
    pill: "bg-teal-50 text-teal-700 border border-teal-200",
    dot: "bg-teal-500",
    pulse: false,
  },
  escalated: {
    label: "Escalated",
    pill: "bg-red-50 text-red-700 border border-red-200",
    dot: "bg-red-500",
    pulse: false,
  },
};

export default function StatusBadge({ status }: { status: ReportStatus }) {
  const { label, pill, dot, pulse } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot} ${pulse ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}
