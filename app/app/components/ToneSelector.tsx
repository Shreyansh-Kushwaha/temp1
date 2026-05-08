"use client";

import { motion } from "framer-motion";
import { Heart, Scale, Briefcase } from "lucide-react";
import type { ToneWarmth } from "@/app/lib/mock-data";

const OPTIONS: { value: ToneWarmth; label: string; icon: React.ElementType }[] = [
  { value: "warm", label: "Warm", icon: Heart },
  { value: "balanced", label: "Balanced", icon: Scale },
  { value: "formal", label: "Formal", icon: Briefcase },
];

export default function ToneSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: ToneWarmth;
  onChange: (next: ToneWarmth) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ss-i-500)] mb-1.5">
        Warmth
      </p>
      <div
        className="relative inline-flex items-center p-0.5 rounded-full bg-[var(--ss-i-100)] border border-[var(--ss-i-200)]"
        role="tablist"
        aria-label="Report warmth"
      >
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              role="tab"
              aria-selected={active}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`relative z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
                active
                  ? "text-white"
                  : "text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)]"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {active && (
                <motion.span
                  layoutId="tone-warmth-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-[var(--ss-o-500)] shadow-[var(--ss-shadow-brand)]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon size={11} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
