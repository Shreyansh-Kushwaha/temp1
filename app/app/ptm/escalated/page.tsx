"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle, Send, UserX } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import { MOCK_ESCALATED, type PTMReport } from "@/app/lib/mock-data";

function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export default function EscalatedPage() {
  const [reports, setReports] = useState<PTMReport[]>(MOCK_ESCALATED);
  const [overriding, setOverriding] = useState<string | null>(null);
  const [overridden, setOverridden] = useState<Set<string>>(new Set());

  async function handleOverride(id: string) {
    setOverriding(id);
    await new Promise((r) => setTimeout(r, 1500));
    setOverriding(null);
    setOverridden((prev) => new Set([...prev, id]));
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ss-error)] mb-1">
            Manager View
          </p>
          <h1 className="text-3xl font-bold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--ss-font-display)" }}>
            Escalated Reports
          </h1>
          <p className="mt-1 text-sm text-[var(--ss-i-500)]">
            These reports hit the 2-cycle rejection cap and need manual intervention.
          </p>
        </div>

        {reports.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-white rounded-2xl shadow-[var(--ss-shadow)] border border-[var(--ss-i-200)] border-l-4 border-l-[var(--ss-error)] overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={14} className="text-[var(--ss-error)]" />
                        <span className="text-xs font-semibold text-[var(--ss-error)] uppercase tracking-wide">
                          Escalated · {report.regeneration_count} cycles
                        </span>
                      </div>
                      <h2 className="text-lg font-semibold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--ss-font-display)" }}>
                        {report.student_name}
                      </h2>
                      <p className="text-sm text-[var(--ss-i-500)]">
                        {report.subject} · {report.draft_content.header.teacher_name} · {formatMonth(report.reporting_month)}
                      </p>
                      <p className="text-xs text-[var(--ss-i-400)] mt-1">
                        Escalated {daysAgo(report.updated_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button className="flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-[var(--ss-i-300)] text-[var(--ss-i-700)] text-sm font-semibold hover:border-[var(--ss-i-500)] hover:bg-[var(--ss-i-100)] transition-colors">
                        <UserX size={14} />
                        Reassign
                      </button>
                      <button
                        onClick={() => handleOverride(report.id)}
                        disabled={overriding === report.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-semibold hover:bg-[var(--ss-o-600)] hover:shadow-[var(--ss-shadow-brand)] disabled:opacity-60 transition-all"
                      >
                        {overriding === report.id ? (
                          <>
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <Send size={14} />
                            Override & Deliver
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[var(--ss-i-200)]">
                    <p className="text-xs font-semibold text-[var(--ss-i-500)] uppercase tracking-wide mb-2">
                      Draft preview
                    </p>
                    <p className="text-sm text-[var(--ss-i-700)] line-clamp-2">
                      {report.draft_content.student_performance.narrative}
                    </p>
                    <Link
                      href={`/ptm/${report.id}`}
                      className="mt-2 inline-block text-xs text-[var(--ss-o-600)] hover:underline"
                    >
                      View full report →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
        <CheckCircle size={24} className="text-green-600" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--ss-i-900)]">No escalations — great work.</h2>
      <p className="text-sm text-[var(--ss-i-400)] mt-1 max-w-xs">
        All reports are being handled within the 2-cycle limit.
      </p>
    </div>
  );
}
