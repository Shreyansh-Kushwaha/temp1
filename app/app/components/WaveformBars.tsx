"use client";

import { motion } from "framer-motion";

/**
 * Decorative animated waveform bars. Synced to a `playing` boolean.
 * Not a real audio analyser — just a stylised, performant visualisation.
 */
export default function WaveformBars({
  playing,
  bars = 28,
  className = "",
}: {
  playing: boolean;
  bars?: number;
  className?: string;
}) {
  // Pre-baked variation seeded by index — stable across renders, lively to look at
  const heights = Array.from({ length: bars }, (_, i) => {
    const t = (i / bars) * Math.PI * 2;
    return 0.4 + 0.5 * Math.abs(Math.sin(t + (i % 5) * 0.7));
  });

  return (
    <div className={`flex items-center gap-[3px] h-10 ${className}`} aria-hidden>
      {heights.map((h, i) => (
        <motion.span
          key={i}
          initial={{ scaleY: 0.4 }}
          animate={
            playing
              ? { scaleY: [h * 0.5, h, h * 0.6, h * 1.05, h * 0.7] }
              : { scaleY: 0.25 }
          }
          transition={{
            duration: playing ? 0.85 + (i % 4) * 0.08 : 0.3,
            repeat: playing ? Infinity : 0,
            ease: "easeInOut",
            delay: (i % 7) * 0.04,
          }}
          className="w-[3px] rounded-full origin-center"
          style={{
            height: "100%",
            background: playing
              ? `linear-gradient(180deg, var(--ss-o-400), var(--ss-o-600))`
              : "var(--ss-i-300)",
          }}
        />
      ))}
    </div>
  );
}
