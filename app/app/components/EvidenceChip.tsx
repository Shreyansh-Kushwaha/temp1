"use client";

import { Quote, Pencil, ClipboardList, FileText } from "lucide-react";
import type { Evidence, EvidenceType } from "@/app/lib/mock-data";

const TYPE_META: Record<
  EvidenceType,
  { label: string; icon: React.ElementType; tone: string }
> = {
  transcript: {
    label: "Session transcript",
    icon: Quote,
    tone: "bg-[var(--ss-i-100)] text-[var(--ss-i-700)] border-[var(--ss-i-200)]",
  },
  teacher_override: {
    label: "Teacher correction",
    icon: Pencil,
    tone: "bg-[var(--ss-o-50)] text-[var(--ss-o-700)] border-[var(--ss-o-200)]",
  },
  attendance_data: {
    label: "Attendance data",
    icon: ClipboardList,
    tone: "bg-blue-50 text-blue-700 border-blue-200",
  },
  session_summary: {
    label: "Session summary",
    icon: FileText,
    tone: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

export default function EvidenceChip({ evidence }: { evidence: Evidence }) {
  const meta = TYPE_META[evidence.type] ?? TYPE_META.session_summary;
  const Icon = meta.icon;
  return (
    <div
      className={`rounded-xl border ${meta.tone} px-3 py-2.5 backdrop-blur-sm flex items-start gap-2.5`}
    >
      <Icon size={13} className="mt-0.5 shrink-0 opacity-80" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
            {meta.label}
          </span>
          {evidence.session_date && (
            <span className="text-[10px] font-medium opacity-60 tabular-nums">
              · {evidence.session_date}
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed font-medium break-words">
          “{evidence.snippet}”
        </p>
      </div>
    </div>
  );
}
