"use client";

import { ArrowDown, ArrowUp, Minus, AlertTriangle } from "lucide-react";
import type { RiskSeverity } from "@/app/lib/mock-data";
import { SEVERITY_META } from "@/app/lib/risk";

export default function RiskIndicator({
  severity,
  trend,
  count,
  size = "md",
}: {
  severity: RiskSeverity;
  trend?: "up" | "down" | "flat" | null;
  count?: number;
  size?: "sm" | "md";
}) {
  const meta = SEVERITY_META[severity];
  const sizing =
    size === "sm" ? "px-2 py-0.5 text-[10px] gap-1" : "px-2.5 py-1 text-xs gap-1.5";
  const icon = size === "sm" ? 9 : 11;

  const TrendIcon =
    trend === "down" ? ArrowDown : trend === "up" ? ArrowUp : Minus;

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border ${meta.bg} ${meta.border} ${meta.text} ${sizing}`}
    >
      <AlertTriangle size={icon} />
      <span className="font-display tracking-wide uppercase">{meta.label}</span>
      {trend && trend !== "flat" && <TrendIcon size={icon} className="opacity-80" />}
      {count != null && count > 1 && (
        <span className="ml-0.5 px-1.5 -mr-0.5 rounded-full bg-white/70 text-[9px] tabular-nums">
          ×{count}
        </span>
      )}
    </span>
  );
}
