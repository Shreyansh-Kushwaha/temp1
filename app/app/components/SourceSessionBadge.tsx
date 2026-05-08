"use client";

import { Calendar } from "lucide-react";

export default function SourceSessionBadge({
  date,
  sessionId,
}: {
  date?: string | null;
  sessionId?: string | null;
}) {
  if (!date && !sessionId) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--ss-i-100)] text-[var(--ss-i-600)] border border-[var(--ss-i-200)]">
      <Calendar size={9} className="opacity-70" />
      {date ?? sessionId}
    </span>
  );
}
