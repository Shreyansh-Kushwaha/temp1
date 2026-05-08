"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function SuggestedPromptChips({
  prompts,
  onPick,
  disabled = false,
}: {
  prompts: string[];
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  if (prompts.length === 0) return null;
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
      className="flex flex-wrap gap-1.5"
    >
      {prompts.map((p) => (
        <motion.button
          key={p}
          type="button"
          disabled={disabled}
          onClick={() => onPick(p)}
          variants={{
            hidden: { opacity: 0, y: 4 },
            visible: { opacity: 1, y: 0 },
          }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[var(--ss-i-200)] text-[11px] font-semibold text-[var(--ss-i-600)] hover:border-[var(--ss-o-300)] hover:bg-[var(--ss-o-50)] hover:text-[var(--ss-o-700)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles size={10} className="opacity-70" />
          {p}
        </motion.button>
      ))}
    </motion.div>
  );
}
