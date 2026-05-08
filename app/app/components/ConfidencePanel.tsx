"use client";

import { motion } from "framer-motion";
import { Sparkles, Info } from "lucide-react";
import type { AIConfidence, ConfidenceSectionKey } from "@/app/lib/mock-data";
import {
  CONFIDENCE_TOOLTIP,
  SECTION_LABELS,
  SECTION_ORDER,
  confidenceTier,
  tierColor,
} from "@/app/lib/confidence";
import ConfidenceMeter from "@/app/components/ConfidenceMeter";

export default function ConfidencePanel({
  confidence,
}: {
  confidence: AIConfidence | null | undefined;
}) {
  if (!confidence) return null;
  const tier = confidenceTier(confidence.overall);
  const c = tierColor(tier);

  return (
    <div className="rounded-2xl border border-[var(--ss-i-200)] bg-white shadow-[var(--ss-shadow)] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--ss-i-500)]">
          <Sparkles size={11} className="text-[var(--ss-o-500)]" />
          AI Confidence
        </span>
        <span className="group relative">
          <Info size={11} className="text-[var(--ss-i-300)] cursor-help" />
          <span className="absolute right-0 top-full mt-2 w-56 p-2.5 bg-[var(--ss-i-900)] text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg leading-relaxed">
            {CONFIDENCE_TOOLTIP}
          </span>
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <motion.span
          key={confidence.overall}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`text-3xl font-extrabold tabular-nums ${c.text}`}
          style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}
        >
          {Math.round(confidence.overall)}
        </motion.span>
        <span className="text-sm text-[var(--ss-i-400)] font-semibold">/ 100</span>
        <span
          className={`ml-auto px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${c.bg} ${c.border} ${c.text}`}
        >
          {tier}
        </span>
      </div>

      <div className="space-y-2.5">
        {SECTION_ORDER.map((key: ConfidenceSectionKey) => {
          const score = confidence.sections[key];
          if (typeof score !== "number") return null;
          return (
            <ConfidenceMeter key={key} score={score} label={SECTION_LABELS[key]} />
          );
        })}
      </div>
    </div>
  );
}
