"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  Network,
  Layers,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Filter,
  Sparkles,
  Wand2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type {
  KnowledgeConceptEntry,
  KnowledgeSummary,
} from "@/app/lib/mock-data";
import { api } from "@/app/lib/api";
import MasteryCard from "@/app/components/MasteryCard";
import ConceptNode from "@/app/components/ConceptNode";
import LearningVelocity from "@/app/components/LearningVelocity";

type StatusFilter = "all" | KnowledgeConceptEntry["status"];

export default function KnowledgePage({
  params,
}: {
  params: Promise<{ student_id: string }>;
}) {
  const { student_id } = use(params);
  const [data, setData] = useState<KnowledgeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.knowledge
      .summary(student_id)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [student_id]);

  async function runGenerate(mode: "create" | "update") {
    setGenerating(true);
    setGenError(null);
    try {
      const next = await api.knowledge.generate(student_id, mode);
      setData(next);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.concepts;
    return data.concepts.filter((c) => c.status === filter);
  }, [data, filter]);

  const nodeLayout = useMemo(() => layoutNodes(filtered), [filtered]);

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          "radial-gradient(1000px 600px at 80% -10%, rgba(255,107,31,.18), transparent 60%), " +
          "radial-gradient(800px 500px at 0% 100%, rgba(124,58,237,.16), transparent 60%), " +
          "linear-gradient(180deg, #0F1115 0%, #1A1E27 100%)",
      }}
    >
      <header className="px-4 md:px-8 pt-7">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href={`/ptm/students/${student_id}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Back to student
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/70">
            <Sparkles size={10} className="text-[var(--ss-o-400)]" />
            Knowledge OS
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-6 pb-16">
        <div className="flex items-end justify-between gap-3 mb-7 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">
              Student Intelligence Dashboard
              {data?.ai_generated && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--ss-o-500)]/20 border border-[var(--ss-o-400)]/30 text-[var(--ss-o-300)] tracking-wider">
                  <Sparkles size={9} /> AI · v{data.generation_count ?? 1}
                </span>
              )}
            </p>
            <h1
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold flex flex-wrap items-center gap-x-2.5 gap-y-1 break-words"
              style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.025em" }}
            >
              <Brain size={26} className="text-[var(--ss-o-400)] shrink-0" />
              <span>{data?.student_name ?? "Student"}</span>
              <span className="text-white/40 font-bold">·</span>
              <span className="text-white/70">{data?.subject ?? "—"}</span>
            </h1>
            <p className="text-sm text-white/50 mt-2 max-w-xl">
              Topics covered, mastery progression, weak concepts, attendance trend, and learning velocity —
              {data?.ai_generated
                ? " AI-generated from session transcripts and prior reports."
                : " aggregated from every report."}
            </p>
          </div>

          {!loading && (
            <button
              onClick={() => runGenerate(data?.ai_generated ? "update" : "create")}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--ss-o-500)] text-white text-xs font-bold hover:bg-[var(--ss-o-600)] disabled:opacity-50 disabled:cursor-not-allowed shadow-[var(--ss-shadow-brand)] transition-all"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              {generating ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  {data?.ai_generated ? "Updating with AI…" : "Generating with AI…"}
                </>
              ) : data?.ai_generated ? (
                <>
                  <RefreshCw size={13} />
                  Update with AI
                </>
              ) : (
                <>
                  <Wand2 size={13} />
                  Generate with AI
                </>
              )}
            </button>
          )}
        </div>

        {genError && (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/5 backdrop-blur-md p-4 text-sm text-red-300 flex items-start gap-2">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {genError}
          </div>
        )}

        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 backdrop-blur-md p-5 text-sm text-red-300">
            {error}
          </div>
        ) : !data ? null : data.concept_summary.total === 0 && !data.ai_generated ? (
          <EmptyKnowledgeCTA
            onGenerate={() => runGenerate("create")}
            generating={generating}
          />
        ) : (
          <>
            {/* Stat row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard
                icon={<Layers size={14} />}
                label="Total Concepts"
                value={data.concept_summary.total}
                accent="white"
              />
              <StatCard
                icon={<CheckCircle2 size={14} />}
                label="Mastered"
                value={data.concept_summary.mastered}
                accent="emerald"
              />
              <StatCard
                icon={<AlertCircle size={14} />}
                label="Weak"
                value={data.concept_summary.weak}
                accent="red"
              />
              <StatCard
                icon={<TrendingUp size={14} />}
                label="Reports"
                value={data.report_count}
                accent="purple"
              />
            </div>

            <div className="grid lg:grid-cols-[1fr_320px] gap-5">
              {/* Main column */}
              <div className="space-y-5 min-w-0">
                {/* Concept relationship graph */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 flex items-center gap-1.5">
                      <Network size={11} />
                      Concept Map
                    </p>
                    <p className="text-[10px] text-white/40">
                      Bubble size = mastery · color = status
                    </p>
                  </div>
                  {filtered.length === 0 ? (
                    <p className="text-xs text-white/40 py-6 text-center">
                      No concepts in this view.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <svg
                        width={nodeLayout.width}
                        height={nodeLayout.height}
                        className="w-full"
                        style={{ minWidth: nodeLayout.width }}
                      >
                        {nodeLayout.nodes.map((n, i) => (
                          <ConceptNode key={n.entry.concept} entry={n.entry} x={n.x} y={n.y} index={i} />
                        ))}
                      </svg>
                    </div>
                  )}
                </div>

                {/* Mastery cards */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5">
                  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 flex items-center gap-1.5">
                      <Layers size={11} />
                      Topic Mastery
                    </p>
                    <FilterBar value={filter} onChange={setFilter} />
                  </div>
                  {filtered.length === 0 ? (
                    <p className="text-xs text-white/40 py-6 text-center">No matching concepts.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {filtered.map((c, i) => (
                        <MasteryCard key={c.concept} entry={c} index={i} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Trend charts */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <TrendChart
                    title="Attendance Trend"
                    points={data.attendance_trend.map((p) => ({
                      label: (p.month || "").slice(0, 7),
                      value: p.attendance_pct,
                    }))}
                    suffix="%"
                    color="var(--ss-o-400)"
                  />
                  <TrendChart
                    title="AI Confidence Trend"
                    points={data.confidence_trend.map((p) => ({
                      label: (p.month || "").slice(0, 7),
                      value: p.overall_confidence,
                    }))}
                    color="#7C3AED"
                  />
                </div>
              </div>

              {/* Sticky insights sidebar */}
              <aside className="lg:sticky lg:top-6 space-y-4 self-start">
                <LearningVelocity
                  velocity={data.learning_velocity}
                  reportCount={data.report_count}
                />

                {data.ai_generated && data.insights && data.insights.length > 0 && (
                  <div className="rounded-2xl bg-white/5 border border-[var(--ss-o-400)]/20 backdrop-blur-md p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ss-o-300)] mb-3 flex items-center gap-1.5">
                      <Sparkles size={11} />
                      AI Insights
                    </p>
                    <ul className="space-y-2 text-[12px] text-white/80 leading-relaxed">
                      {data.insights.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-[var(--ss-o-400)] mt-0.5">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <InsightsPanel data={data} />

                <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2">
                    Mastery Mix
                  </p>
                  <MasteryMix data={data.concept_summary} />
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function FilterBar({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  const opts: { v: StatusFilter; l: string }[] = [
    { v: "all", l: "All" },
    { v: "mastered", l: "Mastered" },
    { v: "learning", l: "Learning" },
    { v: "weak", l: "Weak" },
  ];
  return (
    <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-0.5">
      <Filter size={11} className="ml-2 text-white/40" />
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
            value === o.v
              ? "bg-[var(--ss-o-500)] text-white shadow-[var(--ss-shadow-brand)]"
              : "text-white/50 hover:text-white"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: "white" | "emerald" | "red" | "purple";
}) {
  const accentColor =
    accent === "emerald" ? "text-emerald-300"
    : accent === "red" ? "text-red-300"
    : accent === "purple" ? "text-purple-300"
    : "text-[var(--ss-o-300)]";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4"
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1.5">
        <span className={accentColor}>{icon}</span>
        {label}
      </div>
      <p
        className="text-2xl font-extrabold text-white tabular-nums"
        style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
    </motion.div>
  );
}

function TrendChart({
  title,
  points,
  color,
  suffix = "",
}: {
  title: string;
  points: { label: string; value: number | null }[];
  color: string;
  suffix?: string;
}) {
  const valid = points.filter((p) => typeof p.value === "number") as { label: string; value: number }[];
  if (valid.length === 0) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">
          {title}
        </p>
        <p className="text-xs text-white/40 mt-3">Not enough history yet.</p>
      </div>
    );
  }
  const max = Math.max(...valid.map((p) => p.value), 100);
  const min = Math.min(...valid.map((p) => p.value), 0);
  const range = Math.max(1, max - min);
  const w = 280;
  const h = 90;
  const stepX = valid.length > 1 ? w / (valid.length - 1) : w;
  const path = valid
    .map((p, i) => {
      const x = i * stepX;
      const y = h - ((p.value - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{title}</p>
        <p className="text-sm font-bold text-white tabular-nums">
          {valid[valid.length - 1].value}
          {suffix}
        </p>
      </div>
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full">
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          d={path}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {valid.map((p, i) => (
          <circle
            key={i}
            cx={i * stepX}
            cy={h - ((p.value - min) / range) * h}
            r={3}
            fill={color}
            opacity={0.95}
          />
        ))}
      </svg>
      <div className="flex justify-between mt-1 text-[9px] text-white/40 font-medium">
        {valid.map((p, i) => (
          <span key={i}>{p.label}</span>
        ))}
      </div>
    </motion.div>
  );
}

function InsightsPanel({ data }: { data: KnowledgeSummary }) {
  const topMastered = data.concepts.filter((c) => c.status === "mastered").slice(0, 3);
  const weak = data.concepts.filter((c) => c.status === "weak").slice(0, 3);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3">
        Auto Insights
      </p>
      <ul className="space-y-2.5 text-[12px]">
        {data.report_count < 2 && (
          <li className="text-white/50 italic">
            Insights deepen after the second report — single-month signals are limited.
          </li>
        )}
        {topMastered.length > 0 && (
          <li className="text-white/80">
            Strongest topics:{" "}
            <span className="text-emerald-300 font-semibold">
              {topMastered.map((c) => c.concept).join(", ")}
            </span>
          </li>
        )}
        {weak.length > 0 && (
          <li className="text-white/80">
            Recurring weak areas:{" "}
            <span className="text-red-300 font-semibold">
              {weak.map((c) => c.concept).join(", ")}
            </span>
          </li>
        )}
        {weak.length === 0 && data.report_count >= 2 && (
          <li className="text-white/80">No recurring weaknesses detected — solid trajectory.</li>
        )}
      </ul>
    </div>
  );
}

function MasteryMix({ data }: { data: KnowledgeSummary["concept_summary"] }) {
  const total = data.total || 1;
  const mPct = (data.mastered / total) * 100;
  const lPct = (data.learning / total) * 100;
  const wPct = Math.max(0, 100 - mPct - lPct);
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-white/5 mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${mPct}%` }}
          transition={{ duration: 0.8 }}
          className="bg-emerald-400"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${lPct}%` }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="bg-[var(--ss-o-400)]"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${wPct}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-red-400"
        />
      </div>
      <ul className="text-[11px] text-white/70 space-y-1">
        <li className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Mastered ·{" "}
          <span className="text-white font-semibold">{data.mastered}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--ss-o-400)]" /> Learning ·{" "}
          <span className="text-white font-semibold">{data.learning}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400" /> Weak ·{" "}
          <span className="text-white font-semibold">{data.weak}</span>
        </li>
      </ul>
    </div>
  );
}

function EmptyKnowledgeCTA({
  onGenerate,
  generating,
}: {
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-10 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--ss-o-500)]/15 border border-[var(--ss-o-400)]/30 mb-4">
        <Brain size={24} className="text-[var(--ss-o-300)]" />
      </div>
      <h2
        className="text-xl font-extrabold text-white mb-2"
        style={{ fontFamily: "var(--font-jakarta)" }}
      >
        No knowledge snapshot yet
      </h2>
      <p className="text-sm text-white/60 max-w-md mx-auto mb-5">
        Build the dashboard from this student&apos;s session transcripts and any
        existing PTM reports. The result is saved — next time, click
        <span className="text-[var(--ss-o-300)] font-semibold"> Update with AI </span>
        to refine and append new findings.
      </p>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-bold hover:bg-[var(--ss-o-600)] disabled:opacity-50 disabled:cursor-not-allowed shadow-[var(--ss-shadow-brand)] transition-all"
        style={{ fontFamily: "var(--font-jakarta)" }}
      >
        {generating ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Wand2 size={14} />
            Generate with AI
          </>
        )}
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
        ))}
      </div>
      <div className="h-72 rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="h-32 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
      </div>
    </div>
  );
}

// ── Layout helper ────────────────────────────────────────────────────────────

function layoutNodes(entries: KnowledgeConceptEntry[]): {
  nodes: { entry: KnowledgeConceptEntry; x: number; y: number }[];
  width: number;
  height: number;
} {
  const cols = Math.min(entries.length, 6);
  const colWidth = 150;
  const rowHeight = 120;
  const width = Math.max(700, cols * colWidth);
  const rows = Math.ceil(entries.length / Math.max(1, cols));
  const height = Math.max(220, rows * rowHeight + 60);
  const nodes = entries.map((entry, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const offset = row % 2 === 0 ? 0 : colWidth / 2;
    return {
      entry,
      x: 70 + col * colWidth + offset,
      y: 50 + row * rowHeight,
    };
  });
  return { nodes, width, height };
}
