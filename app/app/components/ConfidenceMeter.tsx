"use client";

import { motion } from "framer-motion";
import { confidenceTier, tierColor } from "@/app/lib/confidence";

export default function ConfidenceMeter({
  score,
  label,
  compact = false,
  pulseLow = true,
}: {
  score: number | null | undefined;
  label?: string;
  compact?: boolean;
  pulseLow?: boolean;
}) {
  const tier = confidenceTier(score);
  const c = tierColor(tier);
  const value = Math.max(0, Math.min(100, score ?? 0));

  return (
    <div className={compact ? "" : "w-full"}>
      {label && (
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-[var(--ss-i-500)] font-semibold uppercase tracking-wider">
            {label}
          </span>
          <span className={`font-bold tabular-nums ${c.text}`}>
            {score == null ? "—" : `${Math.round(value)}%`}
          </span>
        </div>
      )}
      <div
        className={`relative h-1.5 rounded-full bg-[var(--ss-i-100)] overflow-hidden ${
          pulseLow && tier === "low" ? "animate-pulse" : ""
        }`}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full ${c.bar}`}
        />
      </div>
    </div>
  );
}
