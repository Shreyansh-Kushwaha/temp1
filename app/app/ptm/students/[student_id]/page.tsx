"use client";

import { useState, useEffect, use, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Calendar, CheckSquare, Square, Loader2, AlertCircle,
  ChevronRight, Sparkles, BookOpen, Brain, Wand2, FileText,
} from "lucide-react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import CopilotPanel from "@/app/components/CopilotPanel";
import { api, type SessionInfo, type GenerateFromSessionsBody } from "@/app/lib/api";
import { type PTMReport } from "@/app/lib/mock-data";
import { useToast } from "@/app/components/ToastProvider";
import { useGenerationQueue } from "@/app/lib/generation-queue";

const ENGAGEMENT_OPTIONS = [
  { value: "Highly engaged — asked questions and contributed actively", label: "Highly Engaged" },
  { value: "Engaged — participated when prompted", label: "Engaged" },
  { value: "Moderately engaged — some focus drift", label: "Moderately Engaged" },
  { value: "Needed encouragement to stay engaged", label: "Needed Encouragement" },
  { value: "Distracted for most of the class", label: "Distracted" },
];

const CONCEPT_OPTIONS = [
  { value: "Mastered the concept independently", label: "Mastered Independently" },
  { value: "Understood with minimal guidance", label: "Minimal Guidance" },
  { value: "Understood after multiple examples", label: "Multiple Examples" },
  { value: "Partially understood — needs revision", label: "Needs Revision" },
  { value: "Needs significant reinforcement", label: "Needs Reinforcement" },
];

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface PageParams {
  student_id: string;
}

export default function StudentSessionPage({ params }: { params: Promise<PageParams> }) {
  const { student_id } = use(params);
  const searchParams = useSearchParams();

  const teacherName = searchParams.get("teacher_name") ?? "";
  const studentName = searchParams.get("student_name") ?? "";
  const subject = searchParams.get("subject") ?? "";

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Teacher form fields
  const [engagementLevel, setEngagementLevel] = useState("");
  const [conceptUnderstanding, setConceptUnderstanding] = useState("");
  const [homeworkEffort, setHomeworkEffort] = useState("");
  const [specificHighlights, setSpecificHighlights] = useState("");
  const [improvementAreas, setImprovementAreas] = useState("");
  const [parentNote, setParentNote] = useState("");
  const [nextMonthGoals, setNextMonthGoals] = useState("");

  // Brief visual ack on the button after enqueueing — actual lifecycle
  // (pending/success/error) lives in the global generation-queue toast.
  const [justStarted, setJustStarted] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  // All non-deleted reports for this student, refreshed on mount + after a
  // generation completes. Powers the "Open existing report" button so the
  // teacher doesn't run into the duplicate-per-month constraint.
  const [studentReports, setStudentReports] = useState<PTMReport[]>([]);
  const toast = useToast();
  const { enqueue } = useGenerationQueue();
  const router = useRouter();

  // Derive the target reporting_month exactly the way the backend does
  // (earliest selected session date → its month-01; otherwise current month).
  const targetMonth = useMemo(() => {
    const dates = sessions
      .filter((s) => selectedIds.has(s.session_id) && s.date)
      .map((s) => s.date);
    if (dates.length > 0) {
      const earliest = dates.reduce((a, b) => (a < b ? a : b));
      return `${earliest.slice(0, 7)}-01`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }, [sessions, selectedIds]);

  const existingReport = useMemo(
    () => studentReports.find((r) => r.reporting_month === targetMonth),
    [studentReports, targetMonth],
  );

  function refreshStudentReports() {
    api.reports
      .list({ student_id })
      .then((data) => setStudentReports(data))
      .catch(() => { /* silent — gate is best-effort, backend 409 still catches dupes */ });
  }
  useEffect(() => {
    if (!student_id) return;
    refreshStudentReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student_id]);

  async function handleAutoFill() {
    if (selectedIds.size === 0) {
      toast.info("Select at least one session first.");
      return;
    }
    setAutoFilling(true);
    try {
      const result = await api.reports.autoFillForm({
        student_id,
        student_name: studentName || undefined,
        subject: subject || undefined,
        session_ids: Array.from(selectedIds),
      });
      if (result.engagement_level) setEngagementLevel(result.engagement_level);
      if (result.concept_understanding) setConceptUnderstanding(result.concept_understanding);
      if (result.homework_effort) setHomeworkEffort(result.homework_effort);
      if (result.specific_highlights) setSpecificHighlights(result.specific_highlights);
      if (result.improvement_areas) setImprovementAreas(result.improvement_areas);
      if (result.next_month_goals?.length) setNextMonthGoals(result.next_month_goals.join("\n"));

      const filled = [
        result.engagement_level,
        result.concept_understanding,
        result.homework_effort,
        result.specific_highlights,
        result.improvement_areas,
        ...(result.next_month_goals || []),
      ].filter(Boolean).length;
      if (filled === 0) {
        toast.info("AI couldn't infer enough from these sessions — fill the form manually.");
      } else {
        toast.success("Form drafted from sessions — review and edit before generating.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto-fill failed");
    } finally {
      setAutoFilling(false);
    }
  }

  useEffect(() => {
    if (!student_id) return;
    setLoadingSessions(true);
    api.students.sessions(student_id)
      .then((data) => {
        setSessions(data);
        // Auto-select up to 4 most recent sessions
        const ids = data.slice(-4).map((s) => s.session_id);
        setSelectedIds(new Set(ids));
      })
      .catch((e) => setSessionsError(e instanceof Error ? e.message : "Failed to load sessions"))
      .finally(() => setLoadingSessions(false));
  }, [student_id]);

  function toggleSession(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  }

  function handleGenerate() {
    if (selectedIds.size === 0) return;
    const body: GenerateFromSessionsBody = {
      student_id,
      student_name: studentName,
      teacher_name: teacherName,
      subject,
      session_ids: Array.from(selectedIds),
      ...(engagementLevel && { engagement_level: engagementLevel }),
      ...(conceptUnderstanding && { concept_understanding: conceptUnderstanding }),
      ...(homeworkEffort.trim() && { homework_effort: homeworkEffort.trim() }),
      ...(specificHighlights.trim() && { specific_highlights: specificHighlights.trim() }),
      ...(improvementAreas.trim() && { improvement_areas: improvementAreas.trim() }),
      ...(parentNote.trim() && { parent_note: parentNote.trim() }),
      ...(nextMonthGoals.trim() && { next_month_goals: nextMonthGoals.trim().split("\n").filter(Boolean) }),
    };
    // Fire into the global queue. The toast picks up the lifecycle from here.
    // Stay on the page so the user can immediately fire another generation —
    // the toast also gives them a one-click "Open" when the result is ready.
    enqueue(body);
    setJustStarted(true);
    window.setTimeout(() => setJustStarted(false), 1500);
  }

  const initials = studentName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8">
        {/* Back */}
        <Link
          href="/ptm"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--ss-i-400)] hover:text-[var(--ss-i-700)] font-medium mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to students
        </Link>

        {/* Student header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--ss-o-100)] flex items-center justify-center shrink-0">
              <span className="text-[var(--ss-o-700)] font-bold text-lg" style={{ fontFamily: "var(--font-jakarta)" }}>
                {initials}
              </span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-[var(--ss-i-900)] break-words" style={{ fontFamily: "var(--font-jakarta)" }}>
                {studentName || "Student"}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2 py-0.5 rounded-md bg-[var(--ss-i-100)] text-[var(--ss-i-600)] text-xs font-medium">{subject}</span>
                <span className="text-xs text-[var(--ss-i-400)]">·</span>
                <span className="text-xs text-[var(--ss-i-400)]">{teacherName}</span>
              </div>
            </div>
          </div>
          <Link
            href={`/ptm/students/${student_id}/knowledge`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[var(--ss-i-900)] text-white text-xs font-semibold hover:bg-black transition-colors shadow-[0_8px_24px_rgba(15,17,21,.18)]"
          >
            <Brain size={13} />
            Knowledge dashboard
          </Link>
        </div>

        {/* ── Step 1: Session picker ─────────────────────────────────────────── */}
        <Section
          step={1}
          title="Select Sessions"
          description={`Choose up to 4 sessions to include in the report. ${selectedIds.size}/4 selected.`}
        >
          {loadingSessions && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl bg-[var(--ss-i-100)] animate-pulse" />
              ))}
            </div>
          )}

          {sessionsError && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{sessionsError}</p>
            </div>
          )}

          {!loadingSessions && !sessionsError && sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-[var(--ss-i-200)] bg-white">
              <BookOpen size={24} className="text-[var(--ss-i-300)] mb-3" />
              <p className="text-sm font-medium text-[var(--ss-i-600)]">No sessions found</p>
              <p className="text-xs text-[var(--ss-i-400)] mt-1">This student has no recorded sessions with transcripts yet.</p>
            </div>
          )}

          {!loadingSessions && !sessionsError && sessions.length > 0 && (
            <div className="space-y-3">
              {sessions.map((session) => {
                const selected = selectedIds.has(session.session_id);
                const disabled = !selected && selectedIds.size >= 4;
                return (
                  <button
                    key={session.session_id}
                    onClick={() => toggleSession(session.session_id)}
                    disabled={disabled}
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${
                      selected
                        ? "border-[var(--ss-o-400)] bg-[var(--ss-o-50)] shadow-[var(--ss-shadow-brand)]"
                        : disabled
                        ? "border-[var(--ss-i-200)] bg-white opacity-40 cursor-not-allowed"
                        : "border-[var(--ss-i-200)] bg-white hover:border-[var(--ss-o-300)] hover:bg-[var(--ss-o-50)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {selected
                          ? <CheckSquare size={17} className="text-[var(--ss-o-500)]" />
                          : <Square size={17} className="text-[var(--ss-i-300)]" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar size={12} className="text-[var(--ss-i-400)] shrink-0" />
                          <span className="text-xs font-semibold text-[var(--ss-i-600)]">
                            {formatDate(session.date)}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--ss-i-700)] leading-relaxed line-clamp-2">
                          {session.topic_summary || "Session summary not available"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
              {selectedIds.size >= 4 && (
                <p className="text-xs text-[var(--ss-o-600)] font-medium text-center py-1">
                  Maximum 4 sessions selected. Deselect one to pick another.
                </p>
              )}
            </div>
          )}
        </Section>

        {/* ── Step 2: Teacher assessment ─────────────────────────────────────── */}
        <Section
          step={2}
          title="Teacher Assessment"
          description="Your input helps the AI write a more accurate and personalised report."
        >
          <div className="space-y-5">
            <button
              onClick={handleAutoFill}
              disabled={autoFilling || selectedIds.size === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-[var(--ss-o-300)] bg-[var(--ss-o-50)] text-[var(--ss-o-700)] text-sm font-semibold hover:bg-[var(--ss-o-100)] hover:border-[var(--ss-o-400)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {autoFilling ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Reading sessions and drafting…
                </>
              ) : (
                <>
                  <Wand2 size={15} />
                  Auto-fill from selected sessions
                  <span className="text-[var(--ss-o-500)]/70 font-normal">— review before generating</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormSelect
                label="Engagement Level"
                value={engagementLevel}
                onChange={setEngagementLevel}
                options={ENGAGEMENT_OPTIONS}
                placeholder="Select engagement"
              />
              <FormSelect
                label="Concept Understanding"
                value={conceptUnderstanding}
                onChange={setConceptUnderstanding}
                options={CONCEPT_OPTIONS}
                placeholder="Select understanding"
              />
            </div>

            <FormTextarea
              label="Homework & Effort"
              value={homeworkEffort}
              onChange={setHomeworkEffort}
              placeholder="e.g. Completes homework on time, shows effort in practice problems…"
              rows={2}
            />

            <FormTextarea
              label="Specific Highlights"
              value={specificHighlights}
              onChange={setSpecificHighlights}
              placeholder="e.g. Solved a tricky problem independently, asked insightful questions…"
              rows={2}
            />

            <FormTextarea
              label="Areas for Improvement"
              value={improvementAreas}
              onChange={setImprovementAreas}
              placeholder="e.g. Needs to work on speed, could participate more during discussions…"
              rows={2}
            />

            <FormTextarea
              label="Next Month Goals"
              value={nextMonthGoals}
              onChange={setNextMonthGoals}
              placeholder="One goal per line, e.g.&#10;Cover quadratic equations&#10;Weekly revision tests"
              rows={3}
            />

            <FormTextarea
              label="Personal Note to Parents (optional)"
              value={parentNote}
              onChange={setParentNote}
              placeholder="Any specific message you want the parents to read…"
              rows={2}
            />
          </div>
        </Section>

        {/* ── Generate / Open existing button ─────────────────────────────────── */}
        <div className="sticky bottom-6 mt-8">
          {existingReport ? (
            <button
              onClick={() => router.push(`/ptm/${existingReport.id}`)}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-[var(--ss-i-900)] text-white font-bold text-base shadow-[0_8px_24px_rgba(15,17,21,.18)] hover:bg-black transition-all"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              <FileText size={18} />
              Open existing report
              <span className="ml-1 text-white/70 font-normal text-sm">
                · {new Date(existingReport.reporting_month).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                {" · "}{existingReport.status}
              </span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={selectedIds.size === 0}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-[var(--ss-o-500)] text-white font-bold text-base shadow-[var(--ss-shadow-brand)] hover:bg-[var(--ss-o-600)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              {justStarted ? (
                <>
                  <CheckSquare size={18} />
                  Started — see toast
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate Report
                  {selectedIds.size > 0 && (
                    <span className="ml-1 text-white/70 font-normal text-sm">
                      from {selectedIds.size} session{selectedIds.size !== 1 ? "s" : ""}
                    </span>
                  )}
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          )}

          {selectedIds.size === 0 && (
            <p className="text-center text-xs text-[var(--ss-i-400)] mt-2">
              Select at least one session to generate a report.
            </p>
          )}
        </div>
      </main>

      <CopilotPanel studentId={student_id} studentName={studentName} />
    </div>
  );
}

function Section({
  step, title, description, children,
}: {
  step: number; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-7 h-7 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">{step}</span>
        </div>
        <div>
          <h2 className="text-base font-bold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--font-jakarta)" }}>
            {title}
          </h2>
          <p className="text-xs text-[var(--ss-i-400)]">{description}</p>
        </div>
      </div>
      <div className="ml-10">{children}</div>
    </div>
  );
}

function FormSelect({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--ss-i-600)] mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white border border-[var(--ss-i-200)] rounded-xl px-3.5 py-2.5 pr-9 text-sm text-[var(--ss-i-900)] shadow-[var(--ss-shadow)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] transition-all"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ss-i-400)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

function FormTextarea({
  label, value, onChange, placeholder, rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--ss-i-600)] mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-white border border-[var(--ss-i-200)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--ss-i-900)] placeholder-[var(--ss-i-300)] shadow-[var(--ss-shadow)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] transition-all"
      />
    </div>
  );
}
