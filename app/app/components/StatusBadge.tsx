import type { ReportStatus } from "@/app/lib/mock-data";

const config: Record<ReportStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-ss-orange-50 text-ss-orange-700 border border-ss-orange-200",
  },
  approved: {
    label: "Approved",
    className: "bg-green-50 text-green-700 border border-green-200",
  },
  rejected: {
    label: "Rejected",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  delivered: {
    label: "Delivered",
    className: "bg-teal-50 text-teal-700 border border-teal-200",
  },
  escalated: {
    label: "Escalated",
    className: "bg-red-50 text-red-700 border border-red-200",
  },
};

export default function StatusBadge({ status }: { status: ReportStatus }) {
  const { label, className } = config[status];
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
