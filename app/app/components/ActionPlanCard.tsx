"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  MessageCircle,
  Sparkles,
  Target,
  Users,
  Heart,
  Home,
  Check,
} from "lucide-react";
import { useState } from "react";
import type {
  ActionPlanItem,
  ActionPlanCategory,
  ActionPlanIcon,
} from "@/app/lib/mock-data";

const ICON_MAP: Record<ActionPlanIcon, React.ElementType> = {
  book: BookOpen,
  "message-circle": MessageCircle,
  sparkles: Sparkles,
  target: Target,
  users: Users,
  heart: Heart,
};

const CATEGORY_META: Record<
  ActionPlanCategory,
  { label: string; chip: string; ring: string }
> = {
  practice: {
    label: "Practice",
    chip: "bg-[var(--ss-o-50)] text-[var(--ss-o-700)] border-[var(--ss-o-200)]",
    ring: "ring-[var(--ss-o-100)]",
  },
  communication: {
    label: "Communication",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    ring: "ring-blue-100",
  },
  confidence: {
    label: "Confidence",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ring: "ring-emerald-100",
  },
  study: {
    label: "Study",
    chip: "bg-purple-50 text-purple-700 border-purple-200",
    ring: "ring-purple-100",
  },
};

export default function ActionPlanCard({
  items,
  printable = false,
}: {
  items: ActionPlanItem[];
  printable?: boolean;
}) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--ss-i-200)] bg-white shadow-[var(--ss-shadow)] p-6 md:p-7">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-7 h-7 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center">
          <Home size={13} className="text-white" />
        </span>
        <h2
          className="text-base font-extrabold text-[var(--ss-i-900)]"
          style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.01em" }}
        >
          At-Home Action Plan
        </h2>
      </div>
      <p className="text-xs text-[var(--ss-i-500)] mb-5 ml-9">
        Practical, age-appropriate things you can do this month — pick what fits your routine.
      </p>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        className="grid sm:grid-cols-2 gap-3"
      >
        {items.map((item, i) => {
          const Icon = ICON_MAP[item.icon] ?? Sparkles;
          const meta = CATEGORY_META[item.category] ?? CATEGORY_META.practice;
          const done = !!checked[i];
          return (
            <motion.button
              key={i}
              type="button"
              onClick={() => !printable && setChecked((s) => ({ ...s, [i]: !s[i] }))}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={`text-left rounded-2xl border p-4 transition-all ${
                done
                  ? "bg-[var(--ss-o-50)] border-[var(--ss-o-200)] ring-2 ring-[var(--ss-o-100)]"
                  : "bg-white border-[var(--ss-i-200)] hover:border-[var(--ss-i-300)] hover:shadow-[var(--ss-shadow)]"
              } ${printable ? "cursor-default" : "cursor-pointer"}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <span
                  className={`w-9 h-9 rounded-xl ring-2 ${meta.ring} bg-white flex items-center justify-center shrink-0`}
                >
                  <Icon size={15} className="text-[var(--ss-i-700)]" />
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.chip}`}
                >
                  {meta.label}
                </span>
              </div>
              <div className="flex items-start gap-2">
                {!printable && (
                  <span
                    className={`mt-0.5 w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                      done
                        ? "bg-[var(--ss-o-500)] text-white"
                        : "border border-[var(--ss-i-300)] bg-white"
                    }`}
                  >
                    {done && <Check size={10} strokeWidth={3} />}
                  </span>
                )}
                <div className="min-w-0">
                  <p
                    className={`text-sm font-bold mb-1 ${
                      done
                        ? "text-[var(--ss-o-700)] line-through decoration-[var(--ss-o-400)]"
                        : "text-[var(--ss-i-900)]"
                    }`}
                    style={{ fontFamily: "var(--font-jakarta)" }}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-[var(--ss-i-600)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
