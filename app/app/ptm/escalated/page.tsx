"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Send, UserX, ChevronRight, RotateCcw } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import { MOCK_ESCALATED, type PTMReport } from "@/app/lib/mock-data";

function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

export default function EscalatedPage() {
  const [reports, setReports] = useState<PTMReport[]>(MOCK_ESCALATED);
  const [overriding, setOverriding] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function handleOverride(id: string) {
    setOverriding(id);
    await new Promise((r) => setTimeout(r, 1500));
    setOverriding(null);
    setToast("Report delivered to parent via email and WhatsApp.");
    setReports((prev) => prev.filter((r) => r.id !== id));
    setTimeout(() => setToast(null), 3000);
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

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--ss-error)] mb-1.5">
            Escalated
          </p>
          <h1
            className="text-3xl font-extrabold text-[var(--ss-i-900)]"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            Needs your attention
          </h1>
          <p className="mt-1.5 text-sm text-[var(--ss-i-400)] max-w-lg">
            These reports have gone through 2 regeneration cycles and require manual intervention before being sent to parents.
          </p>
        </div>

        {reports.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <EscalatedCard
                key={report.id}
                report={report}
                overriding={overriding === report.id}
                onOverride={() => handleOverride(report.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EscalatedCard({
  report,
  overriding,
  onOverride,
}: {
  report: PTMReport;
  overriding: boolean;
  onOverride: () => void;
}) {
  const inferredFields = report.draft_content._inferred_fields;

  return (
    <div className="bg-white rounded-2xl shadow-[var(--ss-shadow)] overflow-hidden border border-[var(--ss-i-200)]">
      {/* Red left accent */}
      <div className="flex">
        <div className="w-1 shrink-0 bg-[var(--ss-error)]" />
        <div className="flex-1 p-6 md:p-7">
          {/* Top row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            <div>
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle size={11} className="text-[var(--ss-error)]" />
                </div>
                <span className="text-xs font-bold text-[var(--ss-error)] uppercase tracking-wider">
                  Escalated
                </span>
                <span className="text-xs text-[var(--ss-i-300)]">·</span>
                <span className="text-xs text-[var(--ss-i-400)]">{timeAgo(report.updated_at)}</span>
              </div>

              <h2
                className="text-xl font-extrabold text-[var(--ss-i-900)] mb-1"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                {report.student_name}
              </h2>
              <p className="text-sm text-[var(--ss-i-500)]">
                {report.subject} · {report.draft_content.header.teacher_name} · {formatMonth(report.reporting_month)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--ss-i-200)] text-sm text-[var(--ss-i-600)] font-semibold hover:bg-[var(--ss-i-100)] hover:border-[var(--ss-i-300)] transition-colors">
                <UserX size={13} />
                Reassign
              </button>
              <button
                onClick={onOverride}
                disabled={overriding}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-semibold hover:bg-[var(--ss-o-600)] disabled:opacity-60 transition-all shadow-[var(--ss-shadow-brand)]"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                {overriding ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Delivering…
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    Override &amp; Deliver
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Meta badges */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              <RotateCcw size={10} />
              Regenerated {report.regeneration_count}×
            </span>
            {inferredFields.map((field) => (
              <span
                key={field}
                className="px-2.5 py-1 rounded-full bg-[var(--ss-o-50)] border border-[var(--ss-o-200)] text-xs font-medium text-[var(--ss-o-700)]"
              >
                {field.replace(/_/g, " ")}
              </span>
            ))}
          </div>

          {/* Draft preview + link */}
          <div className="p-4 rounded-xl bg-[var(--ss-i-100)] border border-[var(--ss-i-200)]">
            <p className="text-xs font-semibold text-[var(--ss-i-500)] uppercase tracking-wide mb-1.5">
              Draft Preview
            </p>
            <p className="text-sm text-[var(--ss-i-700)] line-clamp-2 leading-relaxed">
              {report.draft_content.student_performance.narrative}
            </p>
            <Link
              href={`/ptm/${report.id}`}
              className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--ss-o-600)] hover:text-[var(--ss-o-700)] font-semibold"
            >
              View full report
              <ChevronRight size={11} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)]">
      <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
        <CheckCircle2 size={26} className="text-green-600" />
      </div>
      <h2
        className="text-lg font-bold text-[var(--ss-i-900)] mb-1"
        style={{ fontFamily: "var(--font-jakarta)" }}
      >
        No escalations — great work.
      </h2>
      <p className="text-sm text-[var(--ss-i-400)] max-w-xs">
        All reports are being resolved within the 2-cycle limit. Check back if a teacher rejects twice.
      </p>
    </div>
  );
}
