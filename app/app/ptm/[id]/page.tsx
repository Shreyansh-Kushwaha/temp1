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
  Users,
  TrendingUp,
  ArrowRight,
  Pencil,
} from "lucide-react";
import Navbar from "@/app/components/Navbar";
import { MOCK_REPORTS, type PTMReport } from "@/app/lib/mock-data";

export default function ReportPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const report = MOCK_REPORTS.find((r) => r.id === id);

  const [showModal, setShowModal] = useState(false);
  const [teacherNote, setTeacherNote] = useState("");
  const [delivering, setDelivering] = useState(false);
  const [delivered, setDelivered] = useState(false);

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ss-bg)" }}>
        <div className="text-center">
          <p className="text-[var(--ss-i-500)]">Report not found.</p>
          <Link href="/ptm" className="mt-4 inline-block text-sm text-[var(--ss-o-600)] underline">
            Back to queue
          </Link>
        </div>
      </div>
    );
  }

  const { draft_content: d } = report;

  async function handleApprove() {
    setDelivering(true);
    await new Promise((r) => setTimeout(r, 1500));
    setDelivering(false);
    setDelivered(true);
    await new Promise((r) => setTimeout(r, 1200));
    router.push("/ptm");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      {/* Teacher-note modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-[var(--ss-i-900)]/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-[var(--ss-shadow-lg)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--ss-font-display)" }}>
                Add a personal note
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-full hover:bg-[var(--ss-i-100)] transition-colors">
                <X size={18} className="text-[var(--ss-i-500)]" />
              </button>
            </div>
            <p className="text-sm text-[var(--ss-i-500)] mb-4">
              Optional — one line for the parent. It will appear at the bottom of the report.
            </p>
            <textarea
              value={teacherNote}
              onChange={(e) => setTeacherNote(e.target.value)}
              placeholder="e.g. Arjun has been putting in great effort — proud of his progress!"
              rows={3}
              className="w-full px-4 py-3 rounded-[10px] border border-[var(--ss-i-300)] bg-white text-[var(--ss-i-900)] placeholder-[var(--ss-i-400)] focus:border-[var(--ss-o-500)] focus:ring-2 focus:ring-[var(--ss-o-200)] outline-none transition text-sm resize-none"
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-full text-[var(--ss-i-700)] hover:bg-[var(--ss-i-100)] transition-colors text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={delivering || delivered}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-[var(--ss-o-500)] text-white font-semibold text-sm hover:bg-[var(--ss-o-600)] hover:shadow-[var(--ss-shadow-brand)] active:bg-[var(--ss-o-700)] disabled:opacity-50 transition-all"
              >
                {delivered ? (
                  <><Check size={15} /> Sent!</>
                ) : delivering ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Sending…
                  </>
                ) : (
                  <><Send size={15} /> Send Report</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        {/* Back + actions bar */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/ptm" className="flex items-center gap-1.5 text-sm text-[var(--ss-i-500)] hover:text-[var(--ss-i-900)] transition-colors">
            <ArrowLeft size={15} />
            Back to queue
          </Link>
          {report.status === "pending" && (
            <div className="flex items-center gap-3">
              <Link
                href={`/ptm/${id}/questionnaire`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-[var(--ss-o-500)] text-[var(--ss-o-600)] text-sm font-semibold hover:bg-[var(--ss-o-50)] transition-colors"
              >
                <MessageSquare size={15} />
                Request Changes
              </Link>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-semibold hover:bg-[var(--ss-o-600)] hover:shadow-[var(--ss-shadow-brand)] active:bg-[var(--ss-o-700)] transition-all"
              >
                <Check size={15} />
                Approve
              </button>
            </div>
          )}
        </div>

        {/* Report card */}
        <div className="bg-white rounded-2xl shadow-[var(--ss-shadow)] border border-[var(--ss-i-200)] overflow-hidden">
          {/* Report header */}
          <div className="px-8 py-6 border-b border-[var(--ss-i-200)] flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center text-white font-bold text-xs">S</span>
                <span className="text-xs font-semibold text-[var(--ss-i-400)] uppercase tracking-wide">Sheldon Labs · Super Sheldon</span>
              </div>
              <h1 className="text-2xl font-bold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--ss-font-display)" }}>
                {d.header.student_name}
              </h1>
              <p className="text-[var(--ss-i-500)] text-sm mt-0.5">
                {d.header.subject} · {d.header.teacher_name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--ss-i-400)] uppercase tracking-wide">Reporting period</p>
              <p className="font-semibold text-[var(--ss-i-700)]">{d.header.reporting_month}</p>
            </div>
          </div>

          <div className="px-8 py-6 space-y-6">
            {/* Block 2 — Sessions & Attendance */}
            <Section icon={<Users size={16} />} title="Sessions & Attendance">
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Classes conducted" value={d.sessions_attendance.total_classes} />
                <StatCard label="Attendance" value={`${d.sessions_attendance.attendance_pct}%`} />
                <StatCard label="No-shows" value={d.sessions_attendance.no_shows} />
              </div>
            </Section>

            {/* Block 3 — Learning Coverage */}
            <InferredSection
              icon={<BookOpen size={16} />}
              title="Learning Coverage"
              inferred={d.learning_coverage.inferred}
            >
              <ul className="space-y-1.5">
                {d.learning_coverage.topics.map((topic, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--ss-i-700)]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--ss-o-400)] shrink-0" />
                    {topic}
                  </li>
                ))}
              </ul>
            </InferredSection>

            {/* Block 4 — Student Performance */}
            <InferredSection
              icon={<TrendingUp size={16} />}
              title="Student Performance"
              inferred={d.student_performance.inferred}
            >
              <p className="text-sm text-[var(--ss-i-700)] leading-relaxed">
                {d.student_performance.narrative}
              </p>
            </InferredSection>

            {/* Block 5 — Next Steps */}
            <InferredSection
              icon={<ArrowRight size={16} />}
              title="Next Steps"
              inferred={d.next_steps.inferred}
            >
              <ul className="space-y-1.5">
                {d.next_steps.topics.map((topic, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--ss-i-700)]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--ss-i-400)] shrink-0" />
                    {topic}
                  </li>
                ))}
              </ul>
            </InferredSection>

            {/* Block 6 — Teacher's Note */}
            <Section icon={<Pencil size={16} />} title="Teacher's Note">
              {report.teacher_note || d.teacher_note ? (
                <p className="text-sm italic text-[var(--ss-i-700)]">
                  &ldquo;{report.teacher_note || d.teacher_note}&rdquo;
                </p>
              ) : (
                <p className="text-sm text-[var(--ss-i-400)] italic">
                  No personal note added yet.
                </p>
              )}
            </Section>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-[var(--ss-i-200)] bg-[var(--ss-i-100)]">
            <p className="text-xs text-[var(--ss-i-400)] text-center">
              Generated by Super Sheldon PTM Agent · Sheldon Labs
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[var(--ss-o-500)]">{icon}</span>
        <h2 className="text-sm font-semibold text-[var(--ss-i-700)] uppercase tracking-wide">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function InferredSection({
  icon,
  title,
  inferred,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  inferred: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl p-4 ${inferred ? "bg-[var(--ss-o-50)] border border-[var(--ss-o-200)]" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[var(--ss-o-500)]">{icon}</span>
          <h2 className="text-sm font-semibold text-[var(--ss-i-700)] uppercase tracking-wide">
            {title}
          </h2>
        </div>
        {inferred && (
          <div className="group relative">
            <Info size={14} className="text-[var(--ss-o-600)] cursor-help" />
            <div className="absolute right-0 bottom-full mb-2 w-56 p-2 bg-[var(--ss-i-900)] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Agent inferred this from class summaries — verify before approving.
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[var(--ss-bg)] rounded-xl p-4 border border-[var(--ss-i-200)]">
      <p className="text-2xl font-bold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--ss-font-display)" }}>
        {value}
      </p>
      <p className="text-xs text-[var(--ss-i-400)] mt-1">{label}</p>
    </div>
  );
}
