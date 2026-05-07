"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Check, FileText } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import StatusBadge from "@/app/components/StatusBadge";
import { MOCK_REPORTS, type PTMReport } from "@/app/lib/mock-data";

function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function hoursAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h === 1) return "1 hour ago";
  return `${h} hours ago`;
}

function isStale(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() > 24 * 3600 * 1000;
}

export default function ApprovalQueuePage() {
  const [reports, setReports] = useState<PTMReport[]>(MOCK_REPORTS);

  const pendingStale = reports.filter(
    (r) => r.status === "pending" && isStale(r.created_at)
  );

  function quickApprove(id: string) {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r))
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {/* Reminder banner */}
        {pendingStale.length > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[var(--ss-o-200)] bg-[var(--ss-o-50)] px-5 py-4">
            <Bell size={18} className="mt-0.5 shrink-0 text-[var(--ss-o-600)]" />
            <p className="text-sm text-[var(--ss-o-700)]">
              <span className="font-semibold">
                {pendingStale.length} report{pendingStale.length > 1 ? "s" : ""} waiting over 24 hours.
              </span>{" "}
              Parents are expecting these — review when you can.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ss-o-600)] mb-1">
            May 2026
          </p>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--ss-font-display)" }}>
            PTM Reports
          </h1>
          <p className="mt-1 text-[var(--ss-i-500)] text-sm">
            Review and approve your students&apos; monthly progress reports.
          </p>
        </div>

        {/* Table */}
        {reports.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-white rounded-2xl shadow-[var(--ss-shadow)] border border-[var(--ss-i-200)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--ss-i-100)] border-b border-[var(--ss-i-200)]">
                  <th className="text-left py-3 px-4 font-semibold text-[var(--ss-i-700)]">Student</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--ss-i-700)]">Subject</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--ss-i-700)] hidden md:table-cell">Month</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--ss-i-700)]">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--ss-i-700)] hidden sm:table-cell">Generated</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ss-i-200)]">
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-[var(--ss-bg)] transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-[var(--ss-i-900)]">
                      {report.student_name}
                    </td>
                    <td className="py-3 px-4 text-[var(--ss-i-700)]">{report.subject}</td>
                    <td className="py-3 px-4 text-[var(--ss-i-500)] hidden md:table-cell">
                      {formatMonth(report.reporting_month)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="py-3 px-4 text-[var(--ss-i-400)] text-xs hidden sm:table-cell">
                      {hoursAgo(report.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 justify-end">
                        {report.status === "pending" && (
                          <button
                            onClick={() => quickApprove(report.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-semibold hover:bg-green-100 transition-colors"
                            title="Quick approve"
                          >
                            <Check size={12} />
                            Approve
                          </button>
                        )}
                        <Link
                          href={`/ptm/${report.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--ss-i-100)] text-[var(--ss-i-700)] text-xs font-semibold hover:bg-[var(--ss-i-200)] transition-colors"
                        >
                          Preview
                          <ChevronRight size={12} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--ss-o-50)] flex items-center justify-center mb-4">
        <FileText size={24} className="text-[var(--ss-o-500)]" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--ss-i-900)]">Nothing here yet — all caught up.</h2>
      <p className="text-sm text-[var(--ss-i-400)] mt-1 max-w-xs">
        Reports are generated on the 1st of every month. Check back then.
      </p>
    </div>
  );
}
