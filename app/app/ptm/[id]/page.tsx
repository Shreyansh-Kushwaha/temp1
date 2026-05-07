"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Info,
  Check,
  MessageSquare,
  X,
  Send,
  BookOpen,
  TrendingUp,
  ArrowRight,
  Pencil,
  RotateCcw,
  CheckCircle2,
  Printer,
} from "lucide-react";
import Navbar from "@/app/components/Navbar";
import StatusBadge from "@/app/components/StatusBadge";
import { MOCK_REPORTS, MOCK_ESCALATED } from "@/app/lib/mock-data";

const ALL_REPORTS = [...MOCK_REPORTS, ...MOCK_ESCALATED];

function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function ReportPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const report = ALL_REPORTS.find((r) => r.id === id);

  const [showModal, setShowModal] = useState(false);
  const [teacherNote, setTeacherNote] = useState("");
  const [delivering, setDelivering] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  if (!report) {
    return (
      <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl border-l-4 border-l-[var(--ss-error)] border border-[var(--ss-i-200)] p-6 shadow-[var(--ss-shadow)]">
            <h2 className="font-bold text-[var(--ss-i-900)] mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>
              Report not found
            </h2>
            <p className="text-sm text-[var(--ss-i-500)] mb-4">
              This report doesn&apos;t exist or may have been removed.
            </p>
            <Link href="/ptm" className="text-sm font-semibold text-[var(--ss-o-600)] hover:underline">
              ← Back to all reports
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { draft_content: d } = report;
  const currentStatus = (localStatus ?? report.status) as typeof report.status;

  async function handleApprove() {
    setDelivering(true);
    await new Promise((r) => setTimeout(r, 1400));
    setDelivering(false);
    setLocalStatus("approved");
    setShowModal(false);
    setToast("Report approved and delivered to parents via email and WhatsApp.");
    setTimeout(() => {
      setToast(null);
      router.push("/ptm");
    }, 2500);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-5 py-3 rounded-full shadow-lg text-sm font-semibold flex items-center gap-2 animate-pulse">
          <CheckCircle2 size={15} />
          {toast}
        </div>
      )}

      {/* Approve modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[var(--ss-i-900)]/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-[var(--ss-shadow-lg)] p-6">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--ss-i-100)] transition-colors"
            >
              <X size={17} className="text-[var(--ss-i-400)]" />
            </button>
            <h2
              className="text-lg font-bold text-[var(--ss-i-900)] mb-1"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
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
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send Report
                  </>
                )}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 text-sm text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)] font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {/* Back link */}
        <Link
          href="/ptm"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--ss-i-400)] hover:text-[var(--ss-i-700)] transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          All Reports
        </Link>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* ── Main content ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Report Header block */}
            <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-6 md:p-7">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center shrink-0">
                    <span className="text-white font-extrabold text-[11px]" style={{ fontFamily: "var(--font-jakarta)" }}>S</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--ss-i-400)] uppercase tracking-widest leading-none">Super Sheldon</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[var(--ss-o-50)] border border-[var(--ss-o-200)] text-xs font-bold text-[var(--ss-o-700)] tracking-wide uppercase">
                  PTM Report
                </span>
              </div>

              <h1
                className="text-3xl font-extrabold text-[var(--ss-i-900)] mb-3"
                style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}
              >
                {d.header.student_name}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ss-i-500)]">
                <span className="px-2.5 py-1 rounded-lg bg-[var(--ss-i-100)] text-xs font-semibold text-[var(--ss-i-700)]">
                  {d.header.subject}
                </span>
                <span>Teacher: <strong className="text-[var(--ss-i-700)]">{d.header.teacher_name}</strong></span>
                <span className="text-[var(--ss-i-300)]">·</span>
                <span>{d.header.reporting_month}</span>
              </div>
            </div>

            {/* Sessions & Attendance */}
            <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-6 md:p-7">
              <SectionLabel label="Sessions & Attendance" />
              <div className="grid grid-cols-3 gap-3 mb-5">
                <MiniStatCard label="Total Classes" value={d.sessions_attendance.total_classes} />
                <MiniStatCard label="Attendance" value={`${d.sessions_attendance.attendance_pct}%`} highlight />
                <MiniStatCard label="No-shows" value={d.sessions_attendance.no_shows} />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-[var(--ss-i-400)] mb-1.5">
                  <span>Attendance rate</span>
                  <span className="font-semibold text-[var(--ss-i-700)]">
                    {d.sessions_attendance.attendance_pct}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--ss-i-100)] overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-[var(--ss-o-500)] transition-all"
                    style={{ width: `${d.sessions_attendance.attendance_pct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Learning Coverage */}
            <InferredBlock
              title="Learning Coverage"
              icon={<BookOpen size={15} />}
              inferred={d.learning_coverage.inferred}
            >
              <ul className="space-y-2.5">
                {d.learning_coverage.topics.map((topic) => (
                  <li key={topic} className="flex items-start gap-2.5 text-sm text-[var(--ss-i-700)]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--ss-o-400)] shrink-0" />
                    {topic}
                  </li>
                ))}
              </ul>
            </InferredBlock>

            {/* Student Performance */}
            <InferredBlock
              title="Student Performance"
              icon={<TrendingUp size={15} />}
              inferred={d.student_performance.inferred}
            >
              <p className="text-sm text-[var(--ss-i-700)] leading-relaxed">
                {d.student_performance.narrative}
              </p>
            </InferredBlock>

            {/* Next Steps */}
            <InferredBlock
              title="Next Steps"
              icon={<ArrowRight size={15} />}
              inferred={d.next_steps.inferred}
            >
              <ul className="space-y-2.5">
                {d.next_steps.topics.slice(0, 4).map((topic) => (
                  <li key={topic} className="flex items-start gap-2.5 text-sm text-[var(--ss-i-700)]">
                    <span className="font-bold text-[var(--ss-o-500)] shrink-0 mt-0.5">→</span>
                    {topic}
                  </li>
                ))}
              </ul>
            </InferredBlock>

            {/* Teacher's Note */}
            <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-6 md:p-7">
              <div className="flex items-center gap-2 mb-3">
                <Pencil size={14} className="text-[var(--ss-i-400)]" />
                <SectionLabel label="Teacher's Note" />
              </div>
              {(report.teacher_note ?? d.teacher_note) ? (
                <p className="text-sm text-[var(--ss-i-600)] italic leading-relaxed">
                  &ldquo;{report.teacher_note ?? d.teacher_note}&rdquo;
                </p>
              ) : (
                <p className="text-sm text-[var(--ss-i-300)] italic">
                  No personal note added yet. You can add one when approving.
                </p>
              )}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <aside className="w-full lg:w-72 shrink-0 space-y-3 lg:sticky lg:top-24">
            <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-5">
              <div className="mb-4">
                <StatusBadge status={currentStatus as typeof report.status} />
              </div>

              <p
                className="text-base font-bold text-[var(--ss-i-900)] mb-0.5"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                {report.student_name}
              </p>
              <p className="text-xs text-[var(--ss-i-400)] mb-5">
                {report.subject} · {formatMonth(report.reporting_month)}
              </p>

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
                  <span className="text-[var(--ss-i-400)] flex items-center gap-1.5">
                    <RotateCcw size={11} />
                    Regenerations
                  </span>
                  <span className="font-semibold text-[var(--ss-i-700)]">
                    {report.regeneration_count} / 2
                  </span>
                </div>

                {d._inferred_fields.length > 0 && (
                  <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-[var(--ss-o-50)] border border-[var(--ss-o-100)]">
                    <Info size={11} className="mt-0.5 text-[var(--ss-o-500)] shrink-0" />
                    <span className="text-xs text-[var(--ss-o-700)] leading-relaxed">
                      Highlighted sections were inferred — verify before approving.
                    </span>
                  </div>
                )}
              </div>
            </div>

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
  return (
    <h2 className="text-xs font-bold text-[var(--ss-i-500)] uppercase tracking-widest">{label}</h2>
  );
}

function MiniStatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className={`text-center p-4 rounded-xl ${highlight ? "bg-[var(--ss-o-50)] border border-[var(--ss-o-200)]" : "bg-[var(--ss-i-100)]"}`}>
      <div
        className={`text-2xl font-extrabold ${highlight ? "text-[var(--ss-o-600)]" : "text-[var(--ss-i-900)]"}`}
        style={{ fontFamily: "var(--font-jakarta)" }}
      >
        {value}
      </div>
      <div className="text-xs text-[var(--ss-i-400)] mt-1">{label}</div>
    </div>
  );
}

function InferredBlock({
  title,
  icon,
  inferred,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  inferred: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border shadow-[var(--ss-shadow)] p-6 md:p-7 ${
        inferred
          ? "bg-[var(--ss-o-50)] border-[var(--ss-o-200)]"
          : "bg-white border-[var(--ss-i-200)]"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={inferred ? "text-[var(--ss-o-500)]" : "text-[var(--ss-i-400)]"}>
            {icon}
          </span>
          <SectionLabel label={title} />
        </div>
        {inferred && (
          <div className="group relative">
            <div className="flex items-center gap-1 text-xs font-semibold text-[var(--ss-o-600)] cursor-help">
              <Info size={12} />
              <span className="hidden sm:inline">Inferred</span>
            </div>
            <div className="absolute right-0 bottom-full mb-2 w-56 p-2.5 bg-[var(--ss-i-900)] text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg leading-relaxed">
              Agent inferred this from class summaries — verify before approving.
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
