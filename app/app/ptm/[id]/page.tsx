"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Info, Check, MessageSquare, X, Send, BookOpen,
  TrendingUp, ArrowRight, Pencil, RotateCcw, CheckCircle2, Printer, AlertCircle, RefreshCw,
  Star, Target, Lightbulb, Heart, Users, ChevronUp, Edit3, Save, XCircle,
} from "lucide-react";
import Navbar from "@/app/components/Navbar";
import StatusBadge from "@/app/components/StatusBadge";
import ConfidenceBadge from "@/app/components/ConfidenceBadge";
import ConfidenceMeter from "@/app/components/ConfidenceMeter";
import ConfidencePanel from "@/app/components/ConfidencePanel";
import ExplainabilityPanel from "@/app/components/ExplainabilityPanel";
import ActionPlanCard from "@/app/components/ActionPlanCard";
import ToneSelector from "@/app/components/ToneSelector";
import DetailLevelSelector from "@/app/components/DetailLevelSelector";
import AudioSummaryCard from "@/app/components/AudioSummaryCard";
import PdfSectionsPanel from "./PdfSectionsPanel";
import {
  type PTMReport,
  type ToneWarmth,
  type ToneDetail,
  type Evidence,
  type AIConfidence,
} from "@/app/lib/mock-data";
import { confidenceTier } from "@/app/lib/confidence";
import { api } from "@/app/lib/api";

// Maps each report section to the AI-confidence sub-score that best reflects it.
const SECTION_TO_CONFIDENCE: Record<string, keyof AIConfidence["sections"] | undefined> = {
  learning_coverage: "academic_understanding",
  student_performance: "academic_understanding",
  confidence_trend: "engagement",
  strengths: "engagement",
  growth_areas: "academic_understanding",
  homework_and_effort: "homework_consistency",
  milestone_of_month: "academic_understanding",
  parent_action_items: "communication",
  next_steps: "academic_understanding",
  recommended_resources: "communication",
  at_home_action_plan: "communication",
};

function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function ReportPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [report, setReport] = useState<PTMReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [teacherNote, setTeacherNote] = useState("");
  const [delivering, setDelivering] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  // ── Editing state ──
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // ── Tone state ──
  const [warmth, setWarmth] = useState<ToneWarmth>("balanced");
  const [detail, setDetail] = useState<ToneDetail>("balanced");
  const [retoning, setRetoning] = useState(false);

  async function fetchReport() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.reports.get(id);
      setReport(data);
      if (data.tone_warmth) setWarmth(data.tone_warmth);
      if (data.tone_detail) setDetail(data.tone_detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchReport(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function applyTone(nextWarmth: ToneWarmth, nextDetail: ToneDetail) {
    if (!report) return;
    if (nextWarmth === report.tone_warmth && nextDetail === report.tone_detail) return;
    setRetoning(true);
    try {
      const res = await api.reports.regenerateWithTone(id, {
        warmth: nextWarmth,
        detail: nextDetail,
      });
      setReport((prev) =>
        prev
          ? {
              ...prev,
              draft_content: res.draft_content,
              tone_warmth: res.tone.warmth,
              tone_detail: res.tone.detail,
            }
          : prev
      );
      setToast(`Re-rendered in ${nextWarmth} · ${nextDetail} tone.`);
      setTimeout(() => setToast(null), 2200);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Tone change failed");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setRetoning(false);
    }
  }

  function startEditing() {
    if (!report) return;
    setEditDraft(JSON.parse(JSON.stringify(report.draft_content)));
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditDraft({});
  }

  async function saveEdits() {
    setSaving(true);
    try {
      await api.reports.patch(id, editDraft);
      setReport((prev) => prev ? { ...prev, draft_content: editDraft as unknown as PTMReport["draft_content"] } : prev);
      setIsEditing(false);
      setToast("Changes saved successfully.");
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to save changes");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  function setField(path: string[], value: unknown) {
    setEditDraft((prev) => {
      const next = { ...prev };
      let cur: Record<string, unknown> = next;
      for (let i = 0; i < path.length - 1; i++) {
        cur[path[i]] = { ...(cur[path[i]] as Record<string, unknown>) };
        cur = cur[path[i]] as Record<string, unknown>;
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  }

  async function handleApprove() {
    setDelivering(true);
    try {
      await api.reports.approve(id, teacherNote || undefined);
      setLocalStatus("approved");
      setShowModal(false);
      setToast("Report approved and delivered to parents via email and WhatsApp.");
      setTimeout(() => { setToast(null); router.push("/ptm"); }, 2500);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to approve report");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDelivering(false);
    }
  }

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          <div className="h-4 w-24 rounded bg-[var(--ss-i-200)] animate-pulse mb-6" />
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-4">
              {[100, 80, 120, 90, 80].map((h, i) => (
                <div key={i} className={`h-${h === 100 ? 28 : h === 80 ? 24 : 32} bg-white rounded-2xl border border-[var(--ss-i-200)] animate-pulse`} style={{ height: `${h}px` }} />
              ))}
            </div>
            <div className="w-full lg:w-72 shrink-0">
              <div className="h-64 bg-white rounded-2xl border border-[var(--ss-i-200)] animate-pulse" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Error state ──
  if (error || !report) {
    return (
      <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl border-l-4 border-l-[var(--ss-error)] border border-[var(--ss-i-200)] p-6 shadow-[var(--ss-shadow)]">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle size={18} className="text-[var(--ss-error)] mt-0.5 shrink-0" />
              <div>
                <h2 className="font-bold text-[var(--ss-i-900)] mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>
                  Report not found
                </h2>
                <p className="text-sm text-[var(--ss-i-500)]">{error ?? "This report doesn't exist or may have been removed."}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/ptm" className="text-sm font-semibold text-[var(--ss-o-600)] hover:underline">
                ← Back to all reports
              </Link>
              {error && (
                <button onClick={fetchReport} className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)]">
                  <RefreshCw size={13} /> Retry
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const d = (isEditing ? editDraft : report.draft_content) as PTMReport["draft_content"];
  const currentStatus = (localStatus ?? report.status) as typeof report.status;

  // Bundle confidence + evidence for a given report section
  function sectionProps(key: string) {
    const subKey = SECTION_TO_CONFIDENCE[key];
    const score =
      subKey && d.ai_confidence ? d.ai_confidence.sections[subKey] : undefined;
    const evidence = (d._evidence ?? {})[key];
    return { confidence: score ?? null, evidence, sectionLabel: prettySection(key) };
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-5 py-3 rounded-full shadow-lg text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={15} />
          {toast}
        </div>
      )}

      {/* Approve modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--ss-i-900)]/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-[var(--ss-shadow-lg)] p-6">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--ss-i-100)] transition-colors">
              <X size={17} className="text-[var(--ss-i-400)]" />
            </button>
            <h2 className="text-lg font-bold text-[var(--ss-i-900)] mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>
              Approve Report
            </h2>
            <p className="text-sm text-[var(--ss-i-400)] mb-5">
              Add an optional personal note for {d.header.student_name.split(" ")[0]}&apos;s parents before sending.
            </p>
            <textarea
              value={teacherNote}
              onChange={(e) => setTeacherNote(e.target.value)}
              placeholder={`e.g. "${d.header.student_name.split(" ")[0]} has been putting in great effort — proud of the progress!"`}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-[var(--ss-i-200)] bg-white text-sm text-[var(--ss-i-700)] placeholder:text-[var(--ss-i-300)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] resize-none transition mb-5"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleApprove}
                disabled={delivering}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-semibold hover:bg-[var(--ss-o-600)] disabled:opacity-60 transition-all shadow-[var(--ss-shadow-brand)]"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                {delivering ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Sending…</>
                ) : (
                  <><Send size={14} />Send Report</>
                )}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)] font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <Link href="/ptm" className="inline-flex items-center gap-1.5 text-sm text-[var(--ss-i-400)] hover:text-[var(--ss-i-700)] transition-colors mb-6">
          <ArrowLeft size={14} />
          All Reports
        </Link>

        {/* ── Editing banner ── */}
        {isEditing && (
          <div className="mb-6 flex items-center justify-between gap-4 bg-[var(--ss-o-50)] border border-[var(--ss-o-200)] rounded-2xl px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <Edit3 size={15} className="text-[var(--ss-o-500)]" />
              <span className="text-sm font-semibold text-[var(--ss-o-700)]">Editing mode — changes are local until you save</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEditing}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-[var(--ss-i-200)] text-[var(--ss-i-600)] hover:bg-[var(--ss-i-100)] transition-colors"
              >
                <XCircle size={12} /> Discard
              </button>
              <button
                onClick={saveEdits}
                disabled={saving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--ss-o-500)] text-white hover:bg-[var(--ss-o-600)] transition-colors disabled:opacity-60"
              >
                {saving ? <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Save size={12} />}
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* ── Main content ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Header block */}
            <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-6 md:p-7">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center shrink-0">
                    <span className="text-white font-extrabold text-[11px]" style={{ fontFamily: "var(--font-jakarta)" }}>S</span>
                  </div>
                  <p className="text-xs font-bold text-[var(--ss-i-400)] uppercase tracking-widest">Super Sheldon</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[var(--ss-o-50)] border border-[var(--ss-o-200)] text-xs font-bold text-[var(--ss-o-700)] tracking-wide uppercase">
                  PTM Report
                </span>
              </div>
              <h1 className="text-3xl font-extrabold text-[var(--ss-i-900)] mb-3" style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}>
                {d.header.student_name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ss-i-500)]">
                <span className="px-2.5 py-1 rounded-lg bg-[var(--ss-i-100)] text-xs font-semibold text-[var(--ss-i-700)]">{d.header.subject}</span>
                <span>Teacher: <strong className="text-[var(--ss-i-700)]">{d.header.teacher_name}</strong></span>
                <span className="text-[var(--ss-i-300)]">·</span>
                <span>{d.header.reporting_period ?? d.header.reporting_month}</span>
              </div>
            </div>

            {/* Sessions & Attendance */}
            <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-6 md:p-7">
              <SectionLabel label="Sessions & Attendance" />
              <div className="grid grid-cols-3 gap-3 mb-5 mt-4">
                <MiniStatCard label="Total Classes" value={d.sessions_attendance.total_classes} />
                <MiniStatCard label="Attendance" value={`${d.sessions_attendance.attendance_pct}%`} highlight />
                <MiniStatCard label="No-shows" value={d.sessions_attendance.no_shows} />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-[var(--ss-i-400)] mb-1.5">
                  <span>Attendance rate</span>
                  <span className="font-semibold text-[var(--ss-i-700)]">{d.sessions_attendance.attendance_pct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--ss-i-100)] overflow-hidden">
                  <div className="h-2 rounded-full bg-[var(--ss-o-500)] transition-all" style={{ width: `${d.sessions_attendance.attendance_pct}%` }} />
                </div>
              </div>
            </div>

            <InferredBlock title="Learning Coverage" icon={<BookOpen size={15} />} inferred={d.learning_coverage?.inferred ?? false} {...sectionProps("learning_coverage")}>
              <ul className="space-y-2.5">
                {(d.learning_coverage?.topics ?? []).map((topic, idx) => {
                  const t = asString(topic);
                  return (
                    <li key={`${t}-${idx}`} className="flex items-start gap-2.5 text-sm text-[var(--ss-i-700)]">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--ss-o-400)] shrink-0" />
                      {t}
                    </li>
                  );
                })}
              </ul>
            </InferredBlock>

            <InferredBlock title="Overall Performance" icon={<TrendingUp size={15} />} inferred={d.student_performance?.inferred ?? false} {...sectionProps("student_performance")}>
              <EditableText
                editing={isEditing}
                value={d.student_performance?.narrative ?? ""}
                onChange={(v) => setField(["student_performance", "narrative"], v)}
                rows={5}
              />
            </InferredBlock>

            {/* Confidence Trend */}
            {d.confidence_trend && (
              <InferredBlock title="Confidence Trend" icon={<ChevronUp size={15} />} inferred={d.confidence_trend.inferred ?? false} {...sectionProps("confidence_trend")}>
                <div className="flex items-center gap-2 mb-3">
                  {isEditing ? (
                    <select
                      value={d.confidence_trend.level ?? "growing"}
                      onChange={(e) => setField(["confidence_trend", "level"], e.target.value)}
                      className="text-xs font-bold px-3 py-1.5 rounded-full border border-[var(--ss-i-200)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)]"
                    >
                      <option value="growing">📈 Growing</option>
                      <option value="steady">📊 Steady</option>
                      <option value="needs_support">🤝 Needs Support</option>
                    </select>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      d.confidence_trend.level === "growing" ? "bg-green-50 text-green-700 border border-green-200"
                      : d.confidence_trend.level === "steady" ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {d.confidence_trend.level === "growing" ? "📈 Growing" : d.confidence_trend.level === "steady" ? "📊 Steady" : "🤝 Needs Support"}
                    </span>
                  )}
                </div>
                <EditableText
                  editing={isEditing}
                  value={d.confidence_trend.observations ?? ""}
                  onChange={(v) => setField(["confidence_trend", "observations"], v)}
                  rows={3}
                />
              </InferredBlock>
            )}

            {/* Strengths */}
            {d.strengths && (
              <InferredBlock title="Key Strengths" icon={<Star size={15} />} inferred={d.strengths.inferred ?? false} {...sectionProps("strengths")}>
                {isEditing ? (
                  <EditableList
                    items={d.strengths.items ?? []}
                    onChange={(v) => setField(["strengths", "items"], v)}
                    icon={<Star size={10} className="text-[var(--ss-o-500)]" />}
                    iconBg="bg-[var(--ss-o-100)]"
                  />
                ) : (
                  <ul className="space-y-3">
                    {(d.strengths.items ?? []).map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-[var(--ss-i-700)]">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-[var(--ss-o-100)] flex items-center justify-center shrink-0"><Star size={10} className="text-[var(--ss-o-500)]" /></span>
                        {asString(item)}
                      </li>
                    ))}
                  </ul>
                )}
              </InferredBlock>
            )}

            {/* Growth Areas */}
            {d.growth_areas && (
              <InferredBlock title="Areas to Grow" icon={<Target size={15} />} inferred={d.growth_areas.inferred ?? false} {...sectionProps("growth_areas")}>
                {isEditing ? (
                  <EditableList
                    items={d.growth_areas.items ?? []}
                    onChange={(v) => setField(["growth_areas", "items"], v)}
                    icon={<Target size={10} className="text-[var(--ss-i-500)]" />}
                    iconBg="bg-[var(--ss-i-100)]"
                  />
                ) : (
                  <ul className="space-y-3">
                    {(d.growth_areas.items ?? []).map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-[var(--ss-i-700)]">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-[var(--ss-i-100)] flex items-center justify-center shrink-0"><Target size={10} className="text-[var(--ss-i-500)]" /></span>
                        {asString(item)}
                      </li>
                    ))}
                  </ul>
                )}
              </InferredBlock>
            )}

            {/* Homework & Effort */}
            {d.homework_and_effort && (
              <InferredBlock title="Homework & Effort" icon={<Pencil size={15} />} inferred={d.homework_and_effort.inferred ?? false} {...sectionProps("homework_and_effort")}>
                <EditableText
                  editing={isEditing}
                  value={d.homework_and_effort.narrative ?? ""}
                  onChange={(v) => setField(["homework_and_effort", "narrative"], v)}
                  rows={3}
                />
              </InferredBlock>
            )}

            {/* Milestone */}
            {d.milestone_of_month && (
              <div className="rounded-2xl border border-[var(--ss-o-200)] bg-gradient-to-br from-[var(--ss-o-50)] to-white shadow-[var(--ss-shadow)] p-6 md:p-7">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🏆</span>
                  <SectionLabel label="Milestone" />
                  {d.milestone_of_month.inferred && <span className="ml-auto text-xs font-semibold text-[var(--ss-o-500)] flex items-center gap-1"><Info size={11} />Inferred</span>}
                </div>
                {isEditing ? (
                  <input
                    value={d.milestone_of_month.title ?? ""}
                    onChange={(e) => setField(["milestone_of_month", "title"], e.target.value)}
                    className="w-full text-base font-bold text-[var(--ss-o-700)] bg-white border border-[var(--ss-o-200)] rounded-xl px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)]"
                    placeholder="Milestone title…"
                  />
                ) : (
                  <p className="text-base font-bold text-[var(--ss-o-700)] mb-2" style={{ fontFamily: "var(--font-jakarta)" }}>{d.milestone_of_month.title}</p>
                )}
                <EditableText
                  editing={isEditing}
                  value={d.milestone_of_month.description ?? ""}
                  onChange={(v) => setField(["milestone_of_month", "description"], v)}
                  rows={3}
                />
              </div>
            )}

            {/* Parent Action Items */}
            {d.parent_action_items && (
              <InferredBlock title="What You Can Do at Home" icon={<Users size={15} />} inferred={d.parent_action_items.inferred ?? false} {...sectionProps("parent_action_items")}>
                {isEditing ? (
                  <EditableList
                    items={d.parent_action_items.items ?? []}
                    onChange={(v) => setField(["parent_action_items", "items"], v)}
                    icon={<span className="text-white text-[10px] font-bold">•</span>}
                    iconBg="bg-[var(--ss-o-500)]"
                  />
                ) : (
                  <ul className="space-y-3">
                    {(d.parent_action_items.items ?? []).map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-[var(--ss-i-700)]">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center shrink-0 text-white text-[10px] font-bold">
                          {i + 1}
                        </span>
                        {asString(item)}
                      </li>
                    ))}
                  </ul>
                )}
              </InferredBlock>
            )}

            {/* At-Home Action Plan (AI-generated) */}
            {d.at_home_action_plan && d.at_home_action_plan.items.length > 0 && (
              <ActionPlanCard items={d.at_home_action_plan.items} />
            )}

            {/* Next Steps */}
            <InferredBlock title="Next Steps" icon={<ArrowRight size={15} />} inferred={d.next_steps?.inferred ?? false} {...sectionProps("next_steps")}>
              {isEditing ? (
                <EditableList
                  items={d.next_steps?.topics ?? []}
                  onChange={(v) => setField(["next_steps", "topics"], v)}
                  icon={<span className="font-bold text-[var(--ss-o-500)] text-xs">→</span>}
                  iconBg="bg-transparent border-none"
                />
              ) : (
                <ul className="space-y-2.5">
                  {(d.next_steps?.topics ?? []).map((topic, idx) => {
                    const t = asString(topic);
                    return (
                      <li key={`${t}-${idx}`} className="flex items-start gap-2.5 text-sm text-[var(--ss-i-700)]">
                        <span className="font-bold text-[var(--ss-o-500)] shrink-0 mt-0.5">→</span>
                        {t}
                      </li>
                    );
                  })}
                </ul>
              )}
            </InferredBlock>

            {/* Recommended Resources */}
            {d.recommended_resources && (
              <InferredBlock title="Recommended Resources" icon={<Lightbulb size={15} />} inferred={d.recommended_resources.inferred ?? false} {...sectionProps("recommended_resources")}>
                {isEditing ? (
                  <EditableList
                    items={d.recommended_resources.items ?? []}
                    onChange={(v) => setField(["recommended_resources", "items"], v)}
                    icon={<Lightbulb size={10} className="text-[var(--ss-i-500)]" />}
                    iconBg="bg-[var(--ss-i-100)]"
                  />
                ) : (
                  <ul className="space-y-3">
                    {(d.recommended_resources.items ?? []).map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-[var(--ss-i-700)]">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-[var(--ss-i-100)] flex items-center justify-center shrink-0">
                          <Lightbulb size={10} className="text-[var(--ss-i-500)]" />
                        </span>
                        {asString(item)}
                      </li>
                    ))}
                  </ul>
                )}
              </InferredBlock>
            )}

            {/* Encouragement Message */}
            {d.encouragement_message !== undefined && (
              <div className="rounded-2xl border border-[var(--ss-i-200)] bg-white shadow-[var(--ss-shadow)] p-6 md:p-7">
                <div className="flex items-center gap-2 mb-3">
                  <Heart size={14} className="text-[var(--ss-o-400)]" />
                  <SectionLabel label="A Note for You" />
                </div>
                {isEditing ? (
                  <EditableText
                    editing={true}
                    value={typeof d.encouragement_message === "string" ? d.encouragement_message : ""}
                    onChange={(v) => setField(["encouragement_message"], v)}
                    rows={3}
                    italic
                  />
                ) : (
                  <p className="text-sm text-[var(--ss-i-600)] leading-relaxed italic">&ldquo;{d.encouragement_message as string}&rdquo;</p>
                )}
              </div>
            )}

            {/* Teacher's Note */}
            <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-6 md:p-7">
              <div className="flex items-center gap-2 mb-3">
                <Pencil size={14} className="text-[var(--ss-i-400)]" />
                <SectionLabel label="Teacher's Personal Note" />
              </div>
              {(report.teacher_note ?? d.teacher_note) ? (
                <p className="text-sm text-[var(--ss-i-600)] italic leading-relaxed">&ldquo;{report.teacher_note ?? d.teacher_note as string}&rdquo;</p>
              ) : (
                <p className="text-sm text-[var(--ss-i-300)] italic">No personal note added yet. You can add one when approving.</p>
              )}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <aside className="w-full lg:w-72 shrink-0 space-y-3 lg:sticky lg:top-24">
            {d.ai_confidence && <ConfidencePanel confidence={d.ai_confidence} />}

            <AudioSummaryCard reportId={id} hasScript={!!d.audio_script} />

            <PdfSectionsPanel
              reportId={id}
              draft={d}
              onSaved={(hidden) =>
                setReport((prev) =>
                  prev
                    ? {
                        ...prev,
                        draft_content: { ...prev.draft_content, _pdf_hidden_sections: hidden },
                      }
                    : prev
                )
              }
            />

            {currentStatus === "pending" && (
              <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ss-i-500)]">
                    Humanization
                  </p>
                  {retoning && (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--ss-o-600)]">
                      <span className="w-3 h-3 rounded-full border-2 border-[var(--ss-o-300)] border-t-[var(--ss-o-600)] animate-spin" />
                      Re-rendering…
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  <ToneSelector
                    value={warmth}
                    disabled={retoning}
                    onChange={(next) => {
                      setWarmth(next);
                      void applyTone(next, detail);
                    }}
                  />
                  <DetailLevelSelector
                    value={detail}
                    disabled={retoning}
                    onChange={(next) => {
                      setDetail(next);
                      void applyTone(warmth, next);
                    }}
                  />
                </div>
                <p className="text-[10px] text-[var(--ss-i-400)] mt-3 leading-relaxed">
                  Tone changes regenerate the report instantly — they don&apos;t count toward your 2-cycle revision limit.
                </p>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-5">
              <div className="mb-4"><StatusBadge status={currentStatus as typeof report.status} /></div>
              <p className="text-base font-bold text-[var(--ss-i-900)] mb-0.5" style={{ fontFamily: "var(--font-jakarta)" }}>{report.student_name}</p>
              <p className="text-xs text-[var(--ss-i-400)] mb-5">{report.subject} · {formatMonth(report.reporting_month)}</p>

              {/* Edit toggle */}
              {!isEditing ? (
                <button
                  onClick={startEditing}
                  className="w-full mb-2 py-2.5 rounded-full border border-[var(--ss-i-200)] text-[var(--ss-i-600)] text-sm font-semibold hover:bg-[var(--ss-i-100)] transition-colors flex items-center justify-center gap-2"
                >
                  <Edit3 size={14} />
                  Edit Report
                </button>
              ) : (
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={saveEdits}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-full bg-[var(--ss-o-500)] text-white text-xs font-semibold hover:bg-[var(--ss-o-600)] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {saving ? <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Save size={12} />}
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="flex-1 py-2.5 rounded-full border border-[var(--ss-i-200)] text-[var(--ss-i-600)] text-xs font-semibold hover:bg-[var(--ss-i-100)] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <XCircle size={12} />
                    Discard
                  </button>
                </div>
              )}

              {currentStatus === "pending" ? (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowModal(true)}
                    className="w-full py-2.5 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-semibold hover:bg-[var(--ss-o-600)] transition-colors flex items-center justify-center gap-2 shadow-[var(--ss-shadow-brand)]"
                    style={{ fontFamily: "var(--font-jakarta)" }}
                  >
                    <Check size={14} />
                    Approve Report
                  </button>
                  <Link
                    href={`/ptm/${id}/questionnaire`}
                    className="w-full py-2.5 rounded-full border border-[var(--ss-i-200)] text-[var(--ss-i-600)] text-sm font-semibold hover:bg-[var(--ss-i-100)] transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageSquare size={14} />
                    Request Changes
                  </Link>
                </div>
              ) : (
                <div className="py-2.5 px-3 rounded-xl bg-[var(--ss-i-100)] text-xs text-[var(--ss-i-500)] text-center">
                  This report is <strong>{currentStatus}</strong>.
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-[var(--ss-i-100)] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--ss-i-400)] flex items-center gap-1.5"><RotateCcw size={11} />Regenerations</span>
                  <span className="font-semibold text-[var(--ss-i-700)]">{report.regeneration_count} / 2</span>
                </div>
                {d._inferred_fields.length > 0 && (
                  <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-[var(--ss-o-50)] border border-[var(--ss-o-100)]">
                    <Info size={11} className="mt-0.5 text-[var(--ss-o-500)] shrink-0" />
                    <span className="text-xs text-[var(--ss-o-700)] leading-relaxed">Highlighted sections were inferred — verify before approving.</span>
                  </div>
                )}
              </div>
            </div>

            {report.regeneration_count > 0 && (
              <Link
                href={`/ptm/${id}/diff`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[var(--ss-i-200)] bg-white text-xs text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)] hover:border-[var(--ss-i-300)] transition-colors shadow-[var(--ss-shadow)]"
              >
                <RotateCcw size={13} />
                View regeneration diff
              </Link>
            )}

            <Link
              href={`/ptm/${id}/print`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[var(--ss-i-200)] bg-white text-xs text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)] hover:border-[var(--ss-i-300)] transition-colors shadow-[var(--ss-shadow)]"
            >
              <Printer size={13} />
              View print layout
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <h2 className="text-xs font-bold text-[var(--ss-i-500)] uppercase tracking-widest">{label}</h2>;
}

function prettySection(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Coerce list items to strings — Gemini occasionally returns objects in fields meant to be strings. */
function asString(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    const name = (o.name ?? o.title ?? o.topic) as string | undefined;
    const desc = (o.description ?? o.detail) as string | undefined;
    if (name && desc) return `${name} — ${desc}`;
    return name ?? desc ?? JSON.stringify(item);
  }
  return String(item ?? "");
}

function MiniStatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`text-center p-4 rounded-xl ${highlight ? "bg-[var(--ss-o-50)] border border-[var(--ss-o-200)]" : "bg-[var(--ss-i-100)]"}`}>
      <div className={`text-2xl font-extrabold ${highlight ? "text-[var(--ss-o-600)]" : "text-[var(--ss-i-900)]"}`} style={{ fontFamily: "var(--font-jakarta)" }}>{value}</div>
      <div className="text-xs text-[var(--ss-i-400)] mt-1">{label}</div>
    </div>
  );
}

function InferredBlock({
  title,
  icon,
  inferred,
  children,
  confidence,
  evidence,
  sectionLabel,
}: {
  title: string;
  icon: React.ReactNode;
  inferred: boolean;
  children: React.ReactNode;
  confidence?: number | null;
  evidence?: Evidence[];
  sectionLabel?: string;
}) {
  const tier = confidence != null ? confidenceTier(confidence) : null;
  const lowConfPulse = inferred && tier === "low";

  return (
    <div
      className={`rounded-2xl border shadow-[var(--ss-shadow)] p-6 md:p-7 ${
        inferred ? "bg-[var(--ss-o-50)] border-[var(--ss-o-200)]" : "bg-white border-[var(--ss-i-200)]"
      } ${lowConfPulse ? "animate-pulse-soft" : ""}`}
    >
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={inferred ? "text-[var(--ss-o-500)]" : "text-[var(--ss-i-400)]"}>{icon}</span>
          <SectionLabel label={title} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {confidence != null && (
            <ConfidenceBadge score={confidence} size="sm" pulse={inferred} />
          )}
          {inferred && (
            <div className="group relative">
              <div className="flex items-center gap-1 text-xs font-semibold text-[var(--ss-o-600)] cursor-help">
                <Info size={12} /><span className="hidden sm:inline">Inferred</span>
              </div>
              <div className="absolute right-0 bottom-full mb-2 w-56 p-2.5 bg-[var(--ss-i-900)] text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg leading-relaxed">
                Agent inferred this from class summaries — verify before approving.
              </div>
            </div>
          )}
        </div>
      </div>
      {confidence != null && (
        <div className="mb-4 -mt-1">
          <ConfidenceMeter score={confidence} compact />
        </div>
      )}
      {children}
      {evidence && evidence.length > 0 && (
        <ExplainabilityPanel
          evidence={evidence}
          inferred={inferred}
          sectionLabel={sectionLabel ?? title}
        />
      )}
    </div>
  );
}

function EditableText({
  editing,
  value,
  onChange,
  rows = 4,
  italic = false,
}: {
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  italic?: boolean;
}) {
  if (!editing) {
    return (
      <p className={`text-sm text-[var(--ss-i-700)] leading-relaxed ${italic ? "italic" : ""}`}>
        {value}
      </p>
    );
  }
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full px-3 py-2.5 rounded-xl border border-[var(--ss-i-200)] bg-white text-sm text-[var(--ss-i-700)] placeholder:text-[var(--ss-i-300)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] resize-none transition leading-relaxed"
    />
  );
}

function EditableList({
  items,
  onChange,
  icon,
  iconBg,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  icon: React.ReactNode;
  iconBg: string;
}) {
  function updateItem(i: number, val: string) {
    const next = [...items];
    next[i] = val;
    onChange(next);
  }
  function removeItem(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function addItem() {
    onChange([...items, ""]);
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={`mt-2.5 w-5 h-5 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
            {icon}
          </span>
          <input
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-[var(--ss-i-200)] bg-white text-sm text-[var(--ss-i-700)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] transition"
            placeholder="Enter item…"
          />
          <button
            onClick={() => removeItem(i)}
            className="mt-1.5 p-1.5 rounded-full hover:bg-red-50 text-[var(--ss-i-300)] hover:text-red-500 transition-colors"
            title="Remove"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="mt-1 text-xs font-semibold text-[var(--ss-o-500)] hover:text-[var(--ss-o-600)] flex items-center gap-1 transition-colors"
      >
        + Add item
      </button>
    </div>
  );
}
