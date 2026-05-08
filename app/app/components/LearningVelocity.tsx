"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";

export default function LearningVelocity({
  velocity,
  reportCount,
}: {
  velocity: number;
  reportCount: number;
}) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center shadow-[var(--ss-shadow-brand)]">
          <Zap size={13} className="text-white" />
        </span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
          Learning Velocity
        </p>
      </div>
      <div className="flex items-baseline gap-2">
        <motion.span
          key={velocity}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-extrabold text-white tabular-nums"
          style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}
        >
          {velocity.toFixed(1)}
        </motion.span>
        <span className="text-[12px] text-white/60 font-semibold">new concepts / report</span>
      </div>
      <p className="text-[10px] text-white/40 mt-1">
        Averaged across {reportCount} report{reportCount === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
