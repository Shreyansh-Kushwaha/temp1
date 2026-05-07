"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Check, FileText, Clock, CheckCircle2, Send } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import StatusBadge from "@/app/components/StatusBadge";
import { MOCK_REPORTS, type PTMReport, type ReportStatus } from "@/app/lib/mock-data";

type FilterTab = "all" | ReportStatus;

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "delivered", label: "Delivered" },
];

function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h === 1) return "1 hour ago";
  if (h < 24) return `${h} hours ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

function isStale(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() > 24 * 3600 * 1000;
}

export default function ApprovalQueuePage() {
  const [reports, setReports] = useState<PTMReport[]>(MOCK_REPORTS);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const counts = useMemo(() => ({
    total: reports.length,
    pending: reports.filter((r) => r.status === "pending").length,
    approved: reports.filter((r) => r.status === "approved").length,
    delivered: reports.filter((r) => r.status === "delivered").length,
  }), [reports]);

  const pendingStale = reports.filter(
    (r) => r.status === "pending" && isStale(r.created_at)
  );

  const filtered = activeTab === "all" ? reports : reports.filter((r) => r.status === activeTab);

  function quickApprove(id: string) {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r))
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {/* ── Page header ── */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ss-o-600)] mb-1">
            May 2026
          </p>
          <h1
            className="text-3xl font-extrabold text-[var(--ss-i-900)]"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            PTM Reports
          </h1>
          <p className="mt-1 text-sm text-[var(--ss-i-400)]">
            Review and approve your students&apos; monthly progress reports before they&apos;re sent to parents.
          </p>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Reports" value={counts.total} icon={<FileText size={16} />} color="ink" />
          <StatCard label="Pending" value={counts.pending} icon={<Clock size={16} />} color="orange" />
          <StatCard label="Approved" value={counts.approved} icon={<CheckCircle2 size={16} />} color="green" />
          <StatCard label="Delivered" value={counts.delivered} icon={<Send size={16} />} color="teal" />
        </div>

        {/* ── Stale reminder banner ── */}
        {pendingStale.length > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[var(--ss-o-200)] bg-[var(--ss-o-50)] px-5 py-4">
            <div className="mt-0.5 w-7 h-7 rounded-full bg-[var(--ss-o-100)] flex items-center justify-center shrink-0">
              <Bell size={14} className="text-[var(--ss-o-600)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--ss-o-700)]">
                {pendingStale.length} report{pendingStale.length > 1 ? "s have" : " has"} been waiting over 24 hours
              </p>
              <p className="text-xs text-[var(--ss-o-600)] mt-0.5">
                Parents are expecting these — teachers aim to review within 24 hours.
              </p>
            </div>
          </div>
        )}

        {/* ── Filter tabs ── */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === key
                  ? "bg-[var(--ss-i-900)] text-white"
                  : "text-[var(--ss-i-500)] hover:bg-[var(--ss-i-100)] hover:text-[var(--ss-i-700)]"
              }`}
            >
              {label}
              {key !== "all" && (
                <span className={`ml-1.5 text-xs ${activeTab === key ? "text-white/70" : "text-[var(--ss-i-300)]"}`}>
                  {reports.filter((r) => r.status === key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-white rounded-2xl shadow-[var(--ss-shadow)] border border-[var(--ss-i-200)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--ss-i-100)] border-b border-[var(--ss-i-200)]">
                  <th className="text-left py-3 px-5 font-semibold text-[var(--ss-i-500)] text-xs uppercase tracking-wide">Student</th>
                  <th className="text-left py-3 px-5 font-semibold text-[var(--ss-i-500)] text-xs uppercase tracking-wide">Subject</th>
                  <th className="text-left py-3 px-5 font-semibold text-[var(--ss-i-500)] text-xs uppercase tracking-wide hidden md:table-cell">Month</th>
                  <th className="text-left py-3 px-5 font-semibold text-[var(--ss-i-500)] text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-5 font-semibold text-[var(--ss-i-500)] text-xs uppercase tracking-wide hidden sm:table-cell">Generated</th>
                  <th className="py-3 px-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ss-i-100)]">
                {filtered.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-[var(--ss-bg)] transition-colors group"
                  >
                    <td className="py-3.5 px-5 font-semibold text-[var(--ss-i-900)]">
                      {report.student_name}
                    </td>
                    <td className="py-3.5 px-5 text-[var(--ss-i-500)]">
                      <span className="px-2 py-0.5 rounded-md bg-[var(--ss-i-100)] text-[var(--ss-i-600)] text-xs font-medium">
                        {report.subject}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[var(--ss-i-500)] hidden md:table-cell text-sm">
                      {formatMonth(report.reporting_month)}
                    </td>
                    <td className="py-3.5 px-5">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="py-3.5 px-5 text-[var(--ss-i-400)] text-xs hidden sm:table-cell">
                      {timeAgo(report.created_at)}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2 justify-end">
                        {report.status === "pending" && (
                          <button
                            onClick={() => quickApprove(report.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-semibold hover:bg-green-100 transition-colors"
                          >
                            <Check size={11} />
                            Approve
                          </button>
                        )}
                        <Link
                          href={`/ptm/${report.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--ss-i-100)] text-[var(--ss-i-600)] text-xs font-semibold hover:bg-[var(--ss-i-200)] transition-colors"
                        >
                          Preview
                          <ChevronRight size={11} />
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

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "ink" | "orange" | "green" | "teal";
}) {
  const colorMap = {
    ink: { bg: "bg-[var(--ss-i-100)]", text: "text-[var(--ss-i-500)]", value: "text-[var(--ss-i-900)]" },
    orange: { bg: "bg-[var(--ss-o-50)]", text: "text-[var(--ss-o-600)]", value: "text-[var(--ss-o-700)]" },
    green: { bg: "bg-green-50", text: "text-green-600", value: "text-green-700" },
    teal: { bg: "bg-teal-50", text: "text-teal-600", value: "text-teal-700" },
  };
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] p-5 shadow-[var(--ss-shadow)]">
      <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center ${c.text} mb-3`}>
        {icon}
      </div>
      <div className={`text-2xl font-extrabold ${c.value} mb-0.5`} style={{ fontFamily: "var(--font-jakarta)" }}>
        {value}
      </div>
      <div className="text-xs text-[var(--ss-i-400)] font-medium">{label}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-[var(--ss-i-200)]">
      <div className="w-14 h-14 rounded-2xl bg-[var(--ss-o-50)] flex items-center justify-center mb-4">
        <FileText size={24} className="text-[var(--ss-o-500)]" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--font-jakarta)" }}>
        Nothing here yet — all caught up.
      </h2>
      <p className="text-sm text-[var(--ss-i-400)] mt-1 max-w-xs">
        Reports are generated on the 1st of every month. Check back then.
      </p>
    </div>
  );
}
