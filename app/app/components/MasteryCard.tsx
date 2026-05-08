"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { KnowledgeConceptEntry } from "@/app/lib/mock-data";

const STATUS_META: Record<
  KnowledgeConceptEntry["status"],
  { label: string; icon: React.ElementType; chip: string; ring: string; bar: string }
> = {
  mastered: {
    label: "Mastered",
    icon: CheckCircle2,
    chip: "bg-emerald-100/10 text-emerald-300 border-emerald-300/30",
    ring: "ring-emerald-400/30",
    bar: "from-emerald-500 to-emerald-400",
  },
  learning: {
    label: "Learning",
    icon: Loader2,
    chip: "bg-orange-200/10 text-orange-200 border-orange-300/30",
    ring: "ring-orange-300/30",
    bar: "from-[#FF8526] to-[#FFC089]",
  },
  weak: {
    label: "Weak",
    icon: AlertCircle,
    chip: "bg-red-300/10 text-red-300 border-red-300/30",
    ring: "ring-red-400/30",
    bar: "from-red-500 to-rose-400",
  },
};

export default function MasteryCard({
  entry,
  index = 0,
}: {
  entry: KnowledgeConceptEntry;
  index?: number;
}) {
  const meta = STATUS_META[entry.status];
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className={`relative rounded-2xl p-4 border border-white/10 bg-white/5 backdrop-blur-md ring-1 ${meta.ring}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p
            className="text-[13px] font-bold text-white truncate"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            {entry.concept}
          </p>
          <p className="text-[10px] text-white/50 mt-0.5">
            {entry.appearances} session{entry.appearances === 1 ? "" : "s"}
            {entry.last_month ? ` · last ${entry.last_month.slice(0, 7)}` : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${meta.chip}`}
        >
          <Icon size={9} className={entry.status === "learning" ? "animate-spin" : ""} />
          {meta.label}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${entry.mastery_score}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 + index * 0.04 }}
            className={`h-full rounded-full bg-gradient-to-r ${meta.bar}`}
          />
        </div>
        <span className="text-[11px] font-bold text-white tabular-nums shrink-0">
          {entry.mastery_score}%
        </span>
      </div>
    </motion.div>
  );
}
