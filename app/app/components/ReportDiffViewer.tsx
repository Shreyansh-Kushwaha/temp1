"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitCompareArrows, Plus, Minus, ChevronDown } from "lucide-react";
import { diffDrafts, type FieldDiff } from "@/app/lib/diff";

export default function ReportDiffViewer({
  before,
  after,
  beforeLabel = "Previous version",
  afterLabel = "Current version",
}: {
  before: unknown;
  after: unknown;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const diffs = useMemo(() => diffDrafts(before, after), [before, after]);
  const changedDiffs = diffs.filter((d) => d.changed);
  const unchangedCount = diffs.length - changedDiffs.length;

  const [showUnchanged, setShowUnchanged] = useState(false);
  const stats = useMemo(() => countOps(diffs), [diffs]);

  return (
    <div className="rounded-2xl border border-[var(--ss-i-200)] bg-white shadow-[var(--ss-shadow)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[var(--ss-i-100)]">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[var(--ss-o-100)] flex items-center justify-center">
            <GitCompareArrows size={13} className="text-[var(--ss-o-600)]" />
          </span>
          <div>
            <p className="text-sm font-bold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--font-jakarta)" }}>
              Regeneration Diff
            </p>
            <p className="text-[11px] text-[var(--ss-i-400)]">
              {beforeLabel} <span className="text-[var(--ss-i-300)]">→</span> {afterLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <Plus size={11} /> {stats.added}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            <Minus size={11} /> {stats.removed}
          </span>
        </div>
      </div>

      <div className="divide-y divide-[var(--ss-i-100)]">
        {changedDiffs.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[var(--ss-i-500)]">No textual changes between these versions.</p>
          </div>
        )}
        {changedDiffs.map((d) => (
          <DiffSection key={d.field} d={d} />
        ))}

        {unchangedCount > 0 && (
          <div className="px-5 py-3">
            <button
              onClick={() => setShowUnchanged((v) => !v)}
              className="text-[11px] font-semibold text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)] flex items-center gap-1.5"
              type="button"
            >
              <ChevronDown
                size={12}
                className={`transition-transform ${showUnchanged ? "rotate-180" : ""}`}
              />
              {showUnchanged ? "Hide" : "Show"} {unchangedCount} unchanged section{unchangedCount === 1 ? "" : "s"}
            </button>
            <AnimatePresence initial={false}>
              {showUnchanged && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden mt-3"
                >
                  <ul className="space-y-1 pl-1">
                    {diffs
                      .filter((d) => !d.changed)
                      .map((d) => (
                        <li key={d.field} className="text-[11px] text-[var(--ss-i-400)]">
                          · {d.label}
                        </li>
                      ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function DiffSection({ d }: { d: FieldDiff }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="px-5 py-4"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ss-i-500)] mb-2">
        {d.label}
      </p>
      <p className="text-sm leading-relaxed">
        {d.ops.map((op, i) => {
          if (op.type === "equal") {
            return <span key={i} className="text-[var(--ss-i-700)]">{op.tokens.join("")}</span>;
          }
          if (op.type === "add") {
            return (
              <span
                key={i}
                className="bg-emerald-100 text-emerald-800 rounded-sm px-0.5"
                style={{ boxShadow: "inset 0 -1px 0 rgba(16,185,129,.5)" }}
              >
                {op.tokens.join("")}
              </span>
            );
          }
          return (
            <span
              key={i}
              className="bg-red-100 text-red-700 rounded-sm px-0.5 line-through"
            >
              {op.tokens.join("")}
            </span>
          );
        })}
      </p>
    </motion.div>
  );
}

function countOps(diffs: FieldDiff[]) {
  let added = 0;
  let removed = 0;
  for (const d of diffs) {
    for (const op of d.ops) {
      if (op.type === "add") added += op.tokens.filter((t) => /\w/.test(t)).length;
      else if (op.type === "remove") removed += op.tokens.filter((t) => /\w/.test(t)).length;
    }
  }
  return { added, removed };
}
