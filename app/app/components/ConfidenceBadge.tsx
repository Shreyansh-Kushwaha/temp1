"use client";

import { Sparkles, Info } from "lucide-react";
import { motion } from "framer-motion";
import {
  CONFIDENCE_TOOLTIP,
  confidenceTier,
  tierColor,
} from "@/app/lib/confidence";

export default function ConfidenceBadge({
  score,
  size = "md",
  pulse = false,
}: {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}) {
  const tier = confidenceTier(score);
  const c = tierColor(tier);
  const display = score == null ? "—" : `${Math.round(score)}%`;

  const sizing =
    size === "sm"
      ? "px-2 py-0.5 text-[10px] gap-1"
      : size === "lg"
      ? "px-3 py-1.5 text-sm gap-1.5"
      : "px-2.5 py-1 text-xs gap-1.5";

  const icon = size === "sm" ? 9 : size === "lg" ? 13 : 11;

  return (
    <span className="group relative inline-flex">
      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        className={`inline-flex items-center font-bold rounded-full border ${c.bg} ${c.border} ${c.text} ${sizing} ${
          pulse && tier === "low" ? "animate-pulse" : ""
        }`}
      >
        <Sparkles size={icon} className="opacity-90" />
        <span className="font-display tabular-nums">{display}</span>
      </motion.span>
      <span
        className="absolute right-0 top-full mt-2 w-60 p-2.5 bg-[var(--ss-i-900)] text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg leading-relaxed"
      >
        <span className="flex items-center gap-1.5 font-semibold mb-0.5">
          <Info size={11} />
          AI Confidence
        </span>
        {CONFIDENCE_TOOLTIP}
      </span>
    </span>
  );
}
