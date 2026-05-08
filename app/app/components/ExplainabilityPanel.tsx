"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sparkles, Eye } from "lucide-react";
import type { Evidence } from "@/app/lib/mock-data";
import EvidenceChip from "@/app/components/EvidenceChip";

export default function ExplainabilityPanel({
  evidence,
  inferred,
  sectionLabel,
}: {
  evidence: Evidence[] | undefined;
  inferred: boolean;
  sectionLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const items = evidence ?? [];
  if (items.length === 0 && !inferred) return null;

  return (
    <div
      className="mt-4 rounded-xl border border-white/60 bg-white/60 backdrop-blur-md shadow-[0_4px_16px_rgba(15,17,21,.04)] overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,248,242,0.55) 100%)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left group hover:bg-white/40 transition-colors"
        type="button"
      >
        <span className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[var(--ss-o-100)] flex items-center justify-center">
            <Sparkles size={11} className="text-[var(--ss-o-600)]" />
          </span>
          <span className="text-xs font-semibold text-[var(--ss-i-700)]">
            Why was this generated?
          </span>
          {inferred && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[var(--ss-o-100)] text-[var(--ss-o-700)]">
              <Eye size={9} className="inline -mt-0.5 mr-1" />
              Inferred
            </span>
          )}
          <span className="text-[10px] text-[var(--ss-i-400)] font-medium">
            · {items.length} {items.length === 1 ? "source" : "sources"}
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[var(--ss-i-400)]"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2">
              {sectionLabel && (
                <p className="text-[11px] text-[var(--ss-i-500)] leading-relaxed mb-2">
                  Evidence the agent used to write the
                  <span className="font-semibold text-[var(--ss-i-700)]"> {sectionLabel}</span>
                  {" "}section:
                </p>
              )}
              {items.length === 0 ? (
                <p className="text-xs text-[var(--ss-i-400)] italic">
                  No specific evidence captured. The agent inferred this conservatively from
                  subject and grade norms.
                </p>
              ) : (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.05 } },
                  }}
                  className="space-y-2"
                >
                  {items.map((ev, i) => (
                    <motion.div
                      key={i}
                      variants={{
                        hidden: { opacity: 0, y: 6 },
                        visible: { opacity: 1, y: 0 },
                      }}
                    >
                      <EvidenceChip evidence={ev} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
