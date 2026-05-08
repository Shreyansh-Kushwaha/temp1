"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { StudentRiskGroup } from "@/app/lib/mock-data";
import { SEVERITY_META, SIGNAL_LABEL } from "@/app/lib/risk";
import RiskIndicator from "@/app/components/RiskIndicator";

export default function RiskCard({
  group,
  href,
}: {
  group: StudentRiskGroup;
  href?: string;
}) {
  const meta = SEVERITY_META[group.highest_severity];
  const card = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className={`relative bg-white border rounded-2xl p-4 shadow-[var(--ss-shadow)] border-l-4 ${meta.border}`}
      style={{ borderLeftColor: severityColor(group.highest_severity) }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p
            className="text-sm font-bold text-[var(--ss-i-900)] truncate"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            {group.student_name ?? group.student_id}
          </p>
          <p className="text-[11px] text-[var(--ss-i-500)]">
            {group.subject ?? "—"} · {group.signals.length} signal
            {group.signals.length === 1 ? "" : "s"}
          </p>
        </div>
        <RiskIndicator
          severity={group.highest_severity}
          count={group.signals.length}
          size="sm"
        />
      </div>

      <ul className="space-y-1.5 mt-3">
        {group.signals.slice(0, 3).map((s) => (
          <li
            key={s.id}
            className="flex items-start gap-2 text-[11px] text-[var(--ss-i-600)]"
          >
            <span
              className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: severityColor(s.severity) }}
            />
            <span className="flex-1">
              <span className="font-semibold text-[var(--ss-i-700)]">
                {SIGNAL_LABEL[s.signal_type] ?? s.signal_type}
              </span>{" "}
              — {s.description}
            </span>
          </li>
        ))}
      </ul>

      {href && (
        <div className="mt-3 flex items-center justify-end">
          <span className="text-[11px] font-semibold text-[var(--ss-o-600)] inline-flex items-center gap-1">
            Open student <ArrowRight size={11} />
          </span>
        </div>
      )}
    </motion.div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}

function severityColor(severity: "low" | "medium" | "high"): string {
  if (severity === "high") return "#DC2626";
  if (severity === "medium") return "#F59E0B";
  return "#2563EB";
}
