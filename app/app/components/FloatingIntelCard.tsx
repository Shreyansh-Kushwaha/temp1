"use client";

import { motion } from "framer-motion";
import { Sparkles, TrendingUp, AlertTriangle, BookMarked, Zap, Brain } from "lucide-react";

type Variant = "confidence" | "mastery" | "risk" | "velocity" | "concept" | "insight";

interface IntelCardProps {
  variant: Variant;
  className?: string;
  /** position object — pass any combination of top/left/right/bottom and a rotate */
  rotate?: number;
  delay?: number;
}

/**
 * Holographic UI snippet — a floating glass card that mimics the actual product UI
 * (confidence meter, mastery score, risk pill, etc.). Used as decorative depth on
 * the login page to signal: "this is a real intelligence platform."
 */
export default function FloatingIntelCard({
  variant,
  className = "",
  rotate = 0,
  delay = 0,
}: IntelCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.92, rotate: rotate - 6 }}
      animate={{
        opacity: 1,
        y: [0, -10, 0],
        scale: 1,
        rotate,
      }}
      transition={{
        opacity: { duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] },
        scale: { duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] },
        rotate: { duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] },
        y: {
          duration: 6 + delay,
          repeat: Infinity,
          ease: "easeInOut",
          delay: delay + 0.6,
        },
      }}
      className={`absolute pointer-events-none select-none ${className}`}
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 18,
        boxShadow: "0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
        padding: 14,
        minWidth: 220,
      }}
    >
      <Inner variant={variant} />
      {/* Inner sheen */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-[18px] pointer-events-none"
        style={{
          background:
            "linear-gradient(140deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 38%)",
          mixBlendMode: "overlay",
        }}
      />
    </motion.div>
  );
}

function Inner({ variant }: { variant: Variant }) {
  if (variant === "confidence") {
    return (
      <>
        <Header label="AI CONFIDENCE" Icon={Sparkles} accent="#FF6B1F" />
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-[28px] font-extrabold text-white tabular-nums leading-none" style={{ fontFamily: "var(--font-jakarta)" }}>
            87
          </span>
          <span className="text-[11px] text-white/50 font-semibold">/ 100</span>
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
            high
          </span>
        </div>
        <Bar label="Engagement" pct={82} />
        <Bar label="Academic" pct={91} />
        <Bar label="Homework" pct={74} />
      </>
    );
  }

  if (variant === "mastery") {
    return (
      <>
        <Header label="TOPIC MASTERY" Icon={BookMarked} accent="#A78BFA" />
        <div className="space-y-2">
          <Concept name="Quadratic equations" pct={94} status="mastered" />
          <Concept name="Discriminant" pct={71} status="learning" />
          <Concept name="Word problems" pct={42} status="weak" />
        </div>
      </>
    );
  }

  if (variant === "risk") {
    return (
      <>
        <Header label="STUDENTS AT RISK" Icon={AlertTriangle} accent="#F59E0B" />
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center text-[10px] font-bold text-white">DK</span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-white leading-tight">Dev Kapoor</p>
            <p className="text-[10px] text-white/50 leading-tight">Chess · 2 signals</p>
          </div>
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-400/15 text-red-300 border border-red-400/30">
            high
          </span>
        </div>
        <p className="text-[10px] text-white/60 leading-relaxed">
          Attendance ↓ 12% · engagement ↓ 18%
        </p>
      </>
    );
  }

  if (variant === "velocity") {
    return (
      <>
        <Header label="LEARNING VELOCITY" Icon={Zap} accent="#FF6B1F" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-extrabold text-white tabular-nums leading-none" style={{ fontFamily: "var(--font-jakarta)" }}>
            4.2
          </span>
          <span className="text-[10px] text-white/50 font-semibold">concepts / report</span>
        </div>
        <p className="text-[10px] text-white/40 mt-1">averaged across 6 reports</p>
        <Sparkline />
      </>
    );
  }

  if (variant === "concept") {
    return (
      <>
        <Header label="CONCEPT MAP" Icon={Brain} accent="#A78BFA" />
        <svg viewBox="0 0 220 80" className="w-full">
          <defs>
            <radialGradient id="cn-mast" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(16,185,129,0.85)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.15)" />
            </radialGradient>
            <radialGradient id="cn-learn" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,107,31,0.85)" />
              <stop offset="100%" stopColor="rgba(255,107,31,0.15)" />
            </radialGradient>
            <radialGradient id="cn-weak" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(220,38,38,0.85)" />
              <stop offset="100%" stopColor="rgba(220,38,38,0.15)" />
            </radialGradient>
          </defs>
          <line x1="40" y1="35" x2="110" y2="22" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <line x1="110" y1="22" x2="180" y2="50" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <line x1="40" y1="35" x2="80" y2="60" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <circle cx="40" cy="35" r="14" fill="url(#cn-mast)" />
          <circle cx="110" cy="22" r="11" fill="url(#cn-learn)" />
          <circle cx="180" cy="50" r="9" fill="url(#cn-weak)" />
          <circle cx="80" cy="60" r="8" fill="url(#cn-learn)" />
        </svg>
      </>
    );
  }

  // insight
  return (
    <>
      <Header label="INSIGHT" Icon={TrendingUp} accent="#10B981" />
      <p className="text-[12px] text-white/85 leading-relaxed">
        <span className="font-semibold text-white">Sneha</span> mastered the PEEL paragraph
        method — confidence{" "}
        <span className="text-emerald-300 font-semibold">↑ 14%</span>.
      </p>
    </>
  );
}

function Header({
  label,
  Icon,
  accent,
}: {
  label: string;
  Icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: `${accent}26`, boxShadow: `0 0 12px ${accent}55` }}
      >
        <Icon size={10} style={{ color: accent }} />
      </span>
      <span className="text-[9px] font-bold tracking-widest text-white/60">{label}</span>
    </div>
  );
}

function Bar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="mb-1.5 last:mb-0">
      <div className="flex items-center justify-between text-[9px] mb-0.5">
        <span className="text-white/50 font-semibold tracking-wider uppercase">{label}</span>
        <span className="text-white font-bold tabular-nums">{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full"
          style={{
            background:
              pct >= 75
                ? "linear-gradient(90deg, #34D399, #10B981)"
                : pct >= 50
                ? "linear-gradient(90deg, #FFA14B, #FF6B1F)"
                : "linear-gradient(90deg, #F87171, #DC2626)",
          }}
        />
      </div>
    </div>
  );
}

function Concept({
  name,
  pct,
  status,
}: {
  name: string;
  pct: number;
  status: "mastered" | "learning" | "weak";
}) {
  const dot =
    status === "mastered"
      ? "bg-emerald-400"
      : status === "learning"
      ? "bg-[var(--ss-o-400)]"
      : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <p className="text-[11px] text-white/85 truncate flex-1">{name}</p>
      <span className="text-[10px] text-white/60 font-bold tabular-nums">{pct}%</span>
    </div>
  );
}

function Sparkline() {
  return (
    <svg viewBox="0 0 200 30" className="w-full mt-2">
      <motion.path
        d="M 0 22 L 30 18 L 60 20 L 90 12 L 120 14 L 150 8 L 180 10 L 200 6"
        stroke="rgba(255,107,31,0.85)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
