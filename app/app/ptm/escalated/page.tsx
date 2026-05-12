"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Send, UserX, ChevronRight, RotateCcw, AlertCircle, RefreshCw } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import { type PTMReport } from "@/app/lib/mock-data";
import { api } from "@/app/lib/api";
import { getAuth } from "@/app/lib/auth";

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
  const [reports, setReports] = useState<PTMReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overriding, setOverriding] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchEscalated = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Scope teachers to their own escalations; admin omits the filter.
      const auth = getAuth();
      const teacher_name =
        auth?.role === "teacher" && auth.teacher_name ? auth.teacher_name : undefined;
      const data = await api.escalated.list(teacher_name ? { teacher_name } : undefined);
      setReports(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load escalated reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEscalated(); }, [fetchEscalated]);

  async function handleOverride(id: string) {
    setOverriding(id);
    try {
      await api.escalated.override(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      setToast("Report delivered to parent via email.");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to deliver report");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setOverriding(null);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-5 py-3 rounded-full shadow-lg text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={15} />{toast}
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mb-6 md:mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--ss-error)] mb-1.5">Escalated</p>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--font-jakarta)" }}>
            Needs your attention
          </h1>
          <p className="mt-1.5 text-sm text-[var(--ss-i-400)] max-w-lg">
            These reports have gone through 2 regeneration cycles and require manual intervention before being sent to parents.
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 bg-white rounded-2xl border-l-4 border-l-[var(--ss-error)] border border-[var(--ss-i-200)] p-5 shadow-[var(--ss-shadow)] flex items-start gap-4">
            <AlertCircle size={18} className="text-[var(--ss-error)] mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--ss-i-900)]">Failed to load escalated reports</p>
              <p className="text-xs text-[var(--ss-i-400)] mt-0.5">{error}</p>
            </div>
            <button onClick={fetchEscalated} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--ss-i-200)] text-[var(--ss-i-600)] hover:bg-[var(--ss-i-100)] transition-colors">
              <RefreshCw size={11} />Retry
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[var(--ss-i-200)] overflow-hidden flex">
                <div className="w-1 bg-[var(--ss-i-200)]" />
                <div className="flex-1 p-6 space-y-3">
                  <div className="h-5 w-48 rounded bg-[var(--ss-i-100)] animate-pulse" />
                  <div className="h-4 w-64 rounded bg-[var(--ss-i-100)] animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-6 w-20 rounded-full bg-[var(--ss-i-100)] animate-pulse" />
                    <div className="h-6 w-24 rounded-full bg-[var(--ss-i-100)] animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && (
          reports.length === 0 ? <EmptyState /> : (
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
          )
        )}
      </main>
    </div>
  );
}

function EscalatedCard({ report, overriding, onOverride }: { report: PTMReport; overriding: boolean; onOverride: () => void }) {
  const inferredFields = report.draft_content._inferred_fields;
  return (
    <div className="bg-white rounded-2xl shadow-[var(--ss-shadow)] overflow-hidden border border-[var(--ss-i-200)]">
      <div className="flex">
        <div className="w-1 shrink-0 bg-[var(--ss-error)]" />
        <div className="flex-1 p-4 sm:p-6 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle size={11} className="text-[var(--ss-error)]" />
                </div>
                <span className="text-xs font-bold text-[var(--ss-error)] uppercase tracking-wider">Escalated</span>
                <span className="text-xs text-[var(--ss-i-300)]">·</span>
                <span className="text-xs text-[var(--ss-i-400)]">{timeAgo(report.updated_at)}</span>
              </div>
              <h2 className="text-xl font-extrabold text-[var(--ss-i-900)] mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>{report.student_name}</h2>
              <p className="text-sm text-[var(--ss-i-500)]">{report.subject} · {report.draft_content.header.teacher_name} · {formatMonth(report.reporting_month)}</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:shrink-0">
              <button className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-full border border-[var(--ss-i-200)] text-sm text-[var(--ss-i-600)] font-semibold hover:bg-[var(--ss-i-100)] hover:border-[var(--ss-i-300)] transition-colors min-h-[44px] sm:min-h-0">
                <UserX size={13} />Reassign
              </button>
              <button onClick={onOverride} disabled={overriding}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-semibold hover:bg-[var(--ss-o-600)] disabled:opacity-60 transition-all shadow-[var(--ss-shadow-brand)] min-h-[44px] sm:min-h-0"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                {overriding ? (
                  <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Delivering…</>
                ) : (
                  <><Send size={13} />Override &amp; Deliver</>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              <RotateCcw size={10} />Regenerated {report.regeneration_count}×
            </span>
            {inferredFields.map((field) => (
              <span key={field} className="px-2.5 py-1 rounded-full bg-[var(--ss-o-50)] border border-[var(--ss-o-200)] text-xs font-medium text-[var(--ss-o-700)]">
                {field.replace(/_/g, " ")}
              </span>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-[var(--ss-i-100)] border border-[var(--ss-i-200)]">
            <p className="text-xs font-semibold text-[var(--ss-i-500)] uppercase tracking-wide mb-1.5">Draft Preview</p>
            <p className="text-sm text-[var(--ss-i-700)] line-clamp-2 leading-relaxed">{report.draft_content.student_performance.narrative}</p>
            <Link href={`/ptm/${report.id}`} className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--ss-o-600)] hover:text-[var(--ss-o-700)] font-semibold">
              View full report<ChevronRight size={11} />
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
      <h2 className="text-lg font-bold text-[var(--ss-i-900)] mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>No escalations — great work.</h2>
      <p className="text-sm text-[var(--ss-i-400)] max-w-xs">All reports are being resolved within the 2-cycle limit.</p>
    </div>
  );
}
