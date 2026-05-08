"use client";

import { motion } from "framer-motion";
import type { KnowledgeConceptEntry } from "@/app/lib/mock-data";

const STATUS_TONE: Record<
  KnowledgeConceptEntry["status"],
  { fill: string; ring: string }
> = {
  mastered: { fill: "rgba(16,185,129,0.85)", ring: "rgba(16,185,129,0.45)" },
  learning: { fill: "rgba(255,107,31,0.85)", ring: "rgba(255,107,31,0.45)" },
  weak: { fill: "rgba(220,38,38,0.85)", ring: "rgba(220,38,38,0.45)" },
};

export default function ConceptNode({
  entry,
  x,
  y,
  index = 0,
}: {
  entry: KnowledgeConceptEntry;
  x: number;
  y: number;
  index?: number;
}) {
  const tone = STATUS_TONE[entry.status];
  const radius = 18 + (entry.mastery_score / 100) * 22;
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <circle cx={x} cy={y} r={radius + 6} fill={tone.ring} opacity={0.35} />
      <circle cx={x} cy={y} r={radius} fill={tone.fill} />
      <text
        x={x}
        y={y + radius + 14}
        textAnchor="middle"
        className="fill-white"
        style={{ fontFamily: "var(--font-jakarta)", fontSize: 11, fontWeight: 600 }}
      >
        {truncate(entry.concept, 22)}
      </text>
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        className="fill-white"
        style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-jakarta)" }}
      >
        {entry.mastery_score}
      </text>
    </motion.g>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
