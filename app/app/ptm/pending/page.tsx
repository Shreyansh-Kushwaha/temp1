"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Check, FileText, Clock, CheckCircle2, Send, AlertCircle, RefreshCw, ChevronDown, Trash2 } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import StatusBadge from "@/app/components/StatusBadge";
import StudentsAtRiskSection from "@/app/components/StudentsAtRiskSection";
import ConfidenceBadge from "@/app/components/ConfidenceBadge";
import ApproveModal from "@/app/components/ApproveModal";
import { useToast } from "@/app/components/ToastProvider";
import { type PTMReport, type ReportStatus } from "@/app/lib/mock-data";
import { api } from "@/app/lib/api";
import { getAuth } from "@/app/lib/auth";

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

export default function PendingPage() {
  const [reports, setReports] = useState<PTMReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [approveTarget, setApproveTarget] = useState<PTMReport | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [scopedTeacher, setScopedTeacher] = useState<string | null>(null);
  // Gate the first fetch on the auth read so teachers never get the
  // "no filter → all reports" call before selectedTeacher is set.
  const [authResolved, setAuthResolved] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const auth = getAuth();
    if (auth?.role === "admin") {
      setIsAdminUser(true);
      api.teachers.list()
        .then((data) => setTeachers(data.map((t) => t.teacher_name).filter(Boolean).sort()))
        .catch(() => {});
    } else if (auth?.role === "teacher" && auth.teacher_name) {
      setScopedTeacher(auth.teacher_name);
      setSelectedTeacher(auth.teacher_name);
    }
    setAuthResolved(true);
  }, []);

  const fetchReports = useCallback(async (teacherName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.reports.list(teacherName ? { teacher_name: teacherName } : undefined);
      setReports(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authResolved) return;
    fetchReports(selectedTeacher || undefined);
  }, [authResolved, fetchReports, selectedTeacher]);

  const counts = useMemo(() => ({
    total: reports.length,
    pending: reports.filter((r) => r.status === "pending").length,
    approved: reports.filter((r) => r.status === "approved").length,
    delivered: reports.filter((r) => r.status === "delivered").length,
  }), [reports]);

  const pendingStale = reports.filter((r) => r.status === "pending" && isStale(r.created_at));
  const filtered = activeTab === "all" ? reports : reports.filter((r) => r.status === activeTab);

  function openApprove(report: PTMReport) {
    setApproveTarget(report);
  }

  function handleApproved(reportId: string, info: { recipient: string }) {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: "approved" as ReportStatus } : r)),
    );
    setApproveTarget(null);
    toast.success(`Report approved — sending to ${info.recipient}.`);
  }

  async function deleteReport(id: string) {
    setDeletingId(id);
    try {
      await api.reports.delete(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // ignore transient errors
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      {approveTarget && (
        <ApproveModal
          reportId={approveTarget.id}
          studentName={approveTarget.student_name}
          open={true}
          onClose={() => setApproveTarget(null)}
          onApproved={(info) => handleApproved(approveTarget.id, info)}
        />
      )}

      <main className="max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mb-6 md:mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ss-o-600)] mb-1">
            {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </p>
          <h1
            className="text-2xl md:text-3xl font-extrabold text-[var(--ss-i-900)]"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            Approval Queue
          </h1>
          <p className="mt-1 text-sm text-[var(--ss-i-400)]">
            Review and approve your students&apos; monthly progress reports before they&apos;re sent to parents.
          </p>
        </div>

        {/* Teacher selector — admin only */}
        {isAdminUser ? (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-[var(--ss-i-500)] uppercase tracking-wide mb-2">
              Viewing reports for
            </label>
            <div className="relative inline-block w-full max-w-sm">
              <select
                value={selectedTeacher}
                onChange={(e) => { setSelectedTeacher(e.target.value); setActiveTab("all"); }}
                className="w-full appearance-none bg-white border border-[var(--ss-i-200)] rounded-2xl px-4 py-3 pr-10 text-sm font-semibold text-[var(--ss-i-900)] shadow-[var(--ss-shadow)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] transition-all"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                <option value="">All Teachers</option>
                {teachers.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ss-i-400)] pointer-events-none" />
            </div>
            {selectedTeacher && (
              <button
                onClick={() => { setSelectedTeacher(""); setActiveTab("all"); }}
                className="ml-3 text-xs text-[var(--ss-o-600)] font-medium hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        ) : scopedTeacher ? (
          <div className="mb-6 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--ss-o-50)] border border-[var(--ss-o-200)]">
            <span className="w-7 h-7 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center shadow-[var(--ss-shadow-brand)]">
              <span className="text-white font-bold text-[10px]" style={{ fontFamily: "var(--font-jakarta)" }}>
                {scopedTeacher.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </span>
            </span>
            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ss-o-600)]">Your reports</p>
              <p className="text-sm font-semibold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--font-jakarta)" }}>
                {scopedTeacher}
              </p>
            </div>
          </div>
        ) : null}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Reports" value={counts.total} icon={<FileText size={16} />} color="ink" loading={loading} />
          <StatCard label="Pending" value={counts.pending} icon={<Clock size={16} />} color="orange" loading={loading} />
          <StatCard label="Approved" value={counts.approved} icon={<CheckCircle2 size={16} />} color="green" loading={loading} />
          <StatCard label="Delivered" value={counts.delivered} icon={<Send size={16} />} color="teal" loading={loading} />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-white rounded-2xl border-l-4 border-l-[var(--ss-error)] border border-[var(--ss-i-200)] p-5 shadow-[var(--ss-shadow)] flex items-start gap-4">
            <AlertCircle size={18} className="text-[var(--ss-error)] mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--ss-i-900)]">Failed to load reports</p>
              <p className="text-xs text-[var(--ss-i-400)] mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => fetchReports(selectedTeacher || undefined)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--ss-i-200)] text-[var(--ss-i-600)] hover:bg-[var(--ss-i-100)] transition-colors"
            >
              <RefreshCw size={11} />
              Retry
            </button>
          </div>
        )}

        {/* Stale banner */}
        {!loading && pendingStale.length > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[var(--ss-o-200)] bg-[var(--ss-o-50)] px-5 py-4">
            <div className="mt-0.5 w-7 h-7 rounded-full bg-[var(--ss-o-100)] flex items-center justify-center shrink-0">
              <Bell size={14} className="text-[var(--ss-o-600)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--ss-o-700)]">
                {pendingStale.length} report{pendingStale.length > 1 ? "s have" : " has"} been waiting over 24 hours
              </p>
              <p className="text-xs text-[var(--ss-o-600)] mt-0.5">
                Parents are expecting these — aim to review within 24 hours.
              </p>
            </div>
          </div>
        )}

        <StudentsAtRiskSection />

        {/* Filter tabs */}
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

        {/* Loading skeletons */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-[var(--ss-shadow)] border border-[var(--ss-i-200)] overflow-hidden">
            <div className="bg-[var(--ss-i-100)] border-b border-[var(--ss-i-200)] px-5 py-3 flex gap-8">
              {["w-20", "w-16", "w-24", "w-16", "w-20"].map((w, i) => (
                <div key={i} className={`h-3 ${w} rounded bg-[var(--ss-i-200)] animate-pulse`} />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-8 px-5 py-4 border-b border-[var(--ss-i-100)] last:border-0">
                <div className="h-4 w-32 rounded bg-[var(--ss-i-100)] animate-pulse" />
                <div className="h-5 w-16 rounded-md bg-[var(--ss-i-100)] animate-pulse" />
                <div className="h-5 w-16 rounded-full bg-[var(--ss-i-100)] animate-pulse" />
                <div className="h-4 w-20 rounded bg-[var(--ss-i-100)] animate-pulse hidden sm:block" />
                <div className="ml-auto flex gap-2">
                  <div className="h-7 w-20 rounded-full bg-[var(--ss-i-100)] animate-pulse" />
                  <div className="h-7 w-20 rounded-full bg-[var(--ss-i-100)] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-[var(--ss-i-200)]">
              <div className="w-14 h-14 rounded-2xl bg-[var(--ss-o-50)] flex items-center justify-center mb-4">
                <FileText size={24} className="text-[var(--ss-o-500)]" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--font-jakarta)" }}>
                Nothing here yet — all caught up.
              </h2>
              <p className="text-sm text-[var(--ss-i-400)] mt-1 max-w-xs">
                Use the Generate tab to create a new report.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-[var(--ss-shadow)] border border-[var(--ss-i-200)] overflow-hidden">
              {/* Mobile cards */}
              <ul className="md:hidden divide-y divide-[var(--ss-i-100)]">
                {filtered.map((report) => {
                  const teacherName = report.draft_content?.header?.teacher_name ?? "—";
                  const isConfirmingDelete = confirmDeleteId === report.id;
                  const isDeleting = deletingId === report.id;
                  return (
                    <li key={report.id} className="px-4 py-3.5">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[var(--ss-i-900)] truncate">{report.student_name}</div>
                          <div className="text-[12px] text-[var(--ss-i-500)] mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-[var(--ss-i-100)] text-[var(--ss-i-600)] text-[11px] font-medium">
                              {report.subject}
                            </span>
                            <span>{formatMonth(report.reporting_month)}</span>
                          </div>
                          <div className="text-[11px] text-[var(--ss-i-400)] mt-0.5 truncate">{teacherName} · {timeAgo(report.created_at)}</div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <StatusBadge status={report.status} />
                          {report.overall_confidence != null && (
                            <ConfidenceBadge score={report.overall_confidence} size="sm" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {report.status === "pending" && (
                          <button
                            onClick={() => openApprove(report)}
                            className="flex items-center gap-1 px-3 py-2 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-semibold hover:bg-green-100 transition-colors min-h-[40px]"
                          >
                            <Check size={12} />
                            Approve
                          </button>
                        )}
                        <Link
                          href={`/ptm/${report.id}`}
                          className="flex items-center gap-1 px-3 py-2 rounded-full bg-[var(--ss-i-100)] text-[var(--ss-i-700)] text-xs font-semibold hover:bg-[var(--ss-i-200)] transition-colors min-h-[40px]"
                        >
                          Preview
                          <ChevronRight size={12} />
                        </Link>
                        {isConfirmingDelete ? (
                          <>
                            <button
                              onClick={() => deleteReport(report.id)}
                              disabled={isDeleting}
                              className="flex items-center gap-1 px-3 py-2 rounded-full bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors min-h-[40px]"
                            >
                              {isDeleting && <span className="w-3 h-3 rounded-full border-2 border-red-300 border-t-white animate-spin" />}
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-2 rounded-full text-xs text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)] hover:bg-[var(--ss-i-100)] transition-colors min-h-[40px]"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(report.id)}
                            className="ml-auto p-2 rounded-full text-[var(--ss-i-400)] hover:text-red-600 hover:bg-red-50 transition-colors min-w-[40px] min-h-[40px]"
                            title="Delete report"
                            aria-label="Delete report"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop table — unchanged */}
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="bg-[var(--ss-i-100)] border-b border-[var(--ss-i-200)]">
                    <th className="text-left py-3 px-5 font-semibold text-[var(--ss-i-500)] text-xs uppercase tracking-wide">Student</th>
                    <th className="text-left py-3 px-5 font-semibold text-[var(--ss-i-500)] text-xs uppercase tracking-wide">Subject</th>
                    <th className="text-left py-3 px-5 font-semibold text-[var(--ss-i-500)] text-xs uppercase tracking-wide hidden lg:table-cell">Teacher</th>
                    <th className="text-left py-3 px-5 font-semibold text-[var(--ss-i-500)] text-xs uppercase tracking-wide hidden md:table-cell">Month</th>
                    <th className="text-left py-3 px-5 font-semibold text-[var(--ss-i-500)] text-xs uppercase tracking-wide">Status</th>
                    <th className="text-left py-3 px-5 font-semibold text-[var(--ss-i-500)] text-xs uppercase tracking-wide hidden lg:table-cell">AI&nbsp;Conf.</th>
                    <th className="text-left py-3 px-5 font-semibold text-[var(--ss-i-500)] text-xs uppercase tracking-wide hidden sm:table-cell">Generated</th>
                    <th className="py-3 px-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ss-i-100)]">
                  {filtered.map((report) => {
                    const teacherName = report.draft_content?.header?.teacher_name ?? "—";
                    const isConfirmingDelete = confirmDeleteId === report.id;
                    const isDeleting = deletingId === report.id;
                    return (
                    <tr key={report.id} className="hover:bg-[var(--ss-bg)] transition-colors group">
                      <td className="py-3.5 px-5 font-semibold text-[var(--ss-i-900)]">{report.student_name}</td>
                      <td className="py-3.5 px-5 text-[var(--ss-i-500)]">
                        <span className="px-2 py-0.5 rounded-md bg-[var(--ss-i-100)] text-[var(--ss-i-600)] text-xs font-medium">
                          {report.subject}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-[var(--ss-i-500)] text-sm hidden lg:table-cell">
                        {teacherName}
                      </td>
                      <td className="py-3.5 px-5 text-[var(--ss-i-500)] hidden md:table-cell text-sm">
                        {formatMonth(report.reporting_month)}
                      </td>
                      <td className="py-3.5 px-5">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="py-3.5 px-5 hidden lg:table-cell">
                        {report.overall_confidence != null ? (
                          <ConfidenceBadge score={report.overall_confidence} size="sm" />
                        ) : (
                          <span className="text-[10px] text-[var(--ss-i-300)]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-[var(--ss-i-400)] text-xs hidden sm:table-cell">
                        {timeAgo(report.created_at)}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2 justify-end">
                          {report.status === "pending" && (
                            <button
                              onClick={() => openApprove(report)}
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
                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteReport(report.id)}
                                disabled={isDeleting}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                              >
                                {isDeleting ? (
                                  <span className="w-3 h-3 rounded-full border-2 border-red-300 border-t-white animate-spin" />
                                ) : null}
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1.5 rounded-full text-xs text-[var(--ss-i-400)] hover:text-[var(--ss-i-700)] hover:bg-[var(--ss-i-100)] transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(report.id)}
                              className="p-1.5 rounded-full text-[var(--ss-i-300)] hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                              title="Delete report"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </main>
    </div>
  );
}

function StatCard({
  label, value, icon, color, loading,
}: {
  label: string; value: number; icon: React.ReactNode; color: "ink" | "orange" | "green" | "teal"; loading?: boolean;
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
      <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center ${c.text} mb-3`}>{icon}</div>
      {loading ? (
        <div className="h-8 w-12 rounded-lg bg-[var(--ss-i-100)] animate-pulse mb-1" />
      ) : (
        <div className={`text-2xl font-extrabold ${c.value} mb-0.5`} style={{ fontFamily: "var(--font-jakarta)" }}>{value}</div>
      )}
      <div className="text-xs text-[var(--ss-i-400)] font-medium">{label}</div>
    </div>
  );
}
