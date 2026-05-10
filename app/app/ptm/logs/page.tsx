"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  ScrollText,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import Navbar from "@/app/components/Navbar";
import { api } from "@/app/lib/api";
import type {
  DeliveryLogEntry,
  DeliveryLogResponse,
  DeliveryStatus,
} from "@/app/lib/api";

type StatusFilter = "all" | "sent" | "failed" | "skipped" | "pending";
type ChannelFilter = "all" | "email" | "whatsapp";
type RangeFilter = "all" | "today" | "7d" | "30d";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sent", label: "Sent" },
  { key: "failed", label: "Failed" },
  { key: "skipped", label: "Skipped" },
  { key: "pending", label: "Pending" },
];

const CHANNEL_OPTIONS: { key: ChannelFilter; label: string }[] = [
  { key: "all", label: "All channels" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
];

const RANGE_OPTIONS: { key: RangeFilter; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

function rangeToSince(range: RangeFilter): string | undefined {
  if (range === "all") return undefined;
  const now = new Date();
  if (range === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return start.toISOString();
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 3600 * 1000).toISOString();
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function fullTimestamp(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function prettyMonth(month: string | null): string {
  if (!month) return "—";
  try {
    const d = new Date(month);
    return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  } catch {
    return month;
  }
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; Icon: typeof CheckCircle2; label: string }> = {
  sent: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    Icon: CheckCircle2,
    label: "Sent",
  },
  failed: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    Icon: XCircle,
    label: "Failed",
  },
  skipped: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    Icon: AlertTriangle,
    label: "Skipped",
  },
  pending: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    Icon: Clock,
    label: "Pending",
  },
};

function StatusPill({ status }: { status: DeliveryStatus }) {
  const s = STATUS_STYLES[status] ?? {
    bg: "bg-[var(--ss-i-100)]",
    text: "text-[var(--ss-i-600)]",
    border: "border-[var(--ss-i-200)]",
    Icon: Clock,
    label: status || "—",
  };
  const { Icon } = s;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}
    >
      <Icon size={11} />
      {s.label}
    </span>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "whatsapp") {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-[var(--ss-i-600)]">
        <MessageCircle size={12} className="text-emerald-600" />
        WhatsApp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-[var(--ss-i-600)]">
      <Mail size={12} className="text-[var(--ss-o-600)]" />
      Email
    </span>
  );
}

export default function LogsPage() {
  const [data, setData] = useState<DeliveryLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLogs = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const result = await api.deliveryLog.list({
        status: statusFilter !== "all" ? statusFilter : undefined,
        channel: channelFilter !== "all" ? channelFilter : undefined,
        since: rangeToSince(rangeFilter),
        q: debouncedSearch || undefined,
        limit: 200,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load delivery log");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, channelFilter, rangeFilter, debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => fetchLogs({ silent: true }), 30000);
    return () => clearInterval(t);
  }, [fetchLogs]);

  const handleResend = useCallback(async (logId: string) => {
    setResendingId(logId);
    setToast(null);
    try {
      const result = await api.deliveryLog.resend(logId);
      const channelLabel = result.channel === "whatsapp" ? "WhatsApp" : "Email";
      if (result.status === "sent") {
        setToast({ kind: "ok", msg: `${channelLabel} resent successfully.` });
      } else if (result.status === "skipped") {
        setToast({ kind: "err", msg: `${channelLabel} skipped: ${result.error ?? "unknown reason"}` });
      } else {
        setToast({ kind: "err", msg: `${channelLabel} ${result.status}: ${result.error ?? ""}` });
      }
      await fetchLogs({ silent: true });
    } catch (e) {
      setToast({ kind: "err", msg: e instanceof Error ? e.message : "Resend failed" });
    } finally {
      setResendingId(null);
      setTimeout(() => setToast(null), 5000);
    }
  }, [fetchLogs]);

  const counters = useMemo(() => {
    const e = data?.entries ?? [];
    return {
      total: data?.total ?? 0,
      sent: e.filter((x) => x.status === "sent").length,
      failed: e.filter((x) => x.status === "failed").length,
      skipped: e.filter((x) => x.status === "skipped").length,
      pending: e.filter((x) => x.status === "pending").length,
    };
  }, [data]);

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 left-4 right-4 md:left-auto md:right-6 z-50 rounded-2xl border px-4 py-3 shadow-[var(--ss-shadow)] flex items-start gap-2.5 md:max-w-sm ${
            toast.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {toast.kind === "ok" ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          ) : (
            <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
          )}
          <div className="text-sm">{toast.msg}</div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[var(--ss-o-600)] text-xs font-semibold uppercase tracking-wide mb-1">
              <ScrollText size={14} />
              Delivery Log
            </div>
            <h1
              className="text-2xl md:text-3xl font-bold text-[var(--ss-i-900)]"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Report Deliveries
            </h1>
            <p className="text-sm text-[var(--ss-i-500)] mt-1">
              Every email sent (or attempted) when a teacher approves a report.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchLogs()}
            disabled={refreshing}
            className="self-start inline-flex items-center gap-1.5 px-4 py-2 md:px-3 md:py-1.5 rounded-full text-sm font-medium border border-[var(--ss-i-200)] bg-white text-[var(--ss-i-700)] hover:bg-[var(--ss-i-50)] transition-colors disabled:opacity-50 min-h-[40px] md:min-h-0"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Test-mode banner */}
        {data?.override_active && (
          <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3 shadow-[var(--ss-shadow)]">
            <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <div className="font-semibold mb-0.5">Test mode active</div>
              <div className="leading-snug">
                All approval emails are being redirected to{" "}
                <span className="font-mono font-semibold">{data.override_recipient}</span>{" "}
                instead of the real parent. Real parents are <strong>not</strong>{" "}
                receiving emails. Unset <span className="font-mono">EMAIL_OVERRIDE_RECIPIENT</span>{" "}
                in the backend env to resume real delivery.
              </div>
            </div>
          </div>
        )}

        {/* Counters strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {[
            { key: "all" as const, label: "Total", value: counters.total, color: "text-[var(--ss-i-900)]" },
            { key: "sent" as const, label: "Sent", value: counters.sent, color: "text-emerald-700" },
            { key: "failed" as const, label: "Failed", value: counters.failed, color: "text-rose-700" },
            { key: "skipped" as const, label: "Skipped", value: counters.skipped, color: "text-amber-700" },
            { key: "pending" as const, label: "Pending", value: counters.pending, color: "text-sky-700" },
          ].map(({ key, label, value, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`text-left rounded-2xl border px-4 py-3 bg-white transition-colors ${
                statusFilter === key
                  ? "border-[var(--ss-o-300)] shadow-[var(--ss-shadow-brand)]"
                  : "border-[var(--ss-i-200)] hover:border-[var(--ss-i-300)]"
              }`}
            >
              <div className="text-[11px] uppercase tracking-wide text-[var(--ss-i-500)] font-semibold">
                {label}
              </div>
              <div className={`text-2xl font-bold mt-1 ${color}`} style={{ fontFamily: "var(--font-jakarta)" }}>
                {value}
              </div>
            </button>
          ))}
        </div>

        {/* Filters bar */}
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center mb-4">
          <div className="flex items-center gap-1 bg-white rounded-full border border-[var(--ss-i-200)] p-1 overflow-x-auto -mx-1 px-1 md:mx-0 md:px-1 [&::-webkit-scrollbar]:hidden">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap min-h-[36px] md:min-h-0 md:py-1 ${
                  statusFilter === t.key
                    ? "bg-[var(--ss-o-500)] text-white"
                    : "text-[var(--ss-i-600)] hover:text-[var(--ss-i-900)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 md:contents">
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
              className="flex-1 md:flex-none px-3 py-2 md:py-1.5 rounded-full border border-[var(--ss-i-200)] bg-white text-xs font-medium text-[var(--ss-i-700)] min-h-[40px] md:min-h-0"
            >
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              value={rangeFilter}
              onChange={(e) => setRangeFilter(e.target.value as RangeFilter)}
              className="flex-1 md:flex-none px-3 py-2 md:py-1.5 rounded-full border border-[var(--ss-i-200)] bg-white text-xs font-medium text-[var(--ss-i-700)] min-h-[40px] md:min-h-0"
            >
              {RANGE_OPTIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full md:flex-1 md:min-w-[200px] relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ss-i-400)]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student or email…"
              className="w-full pl-8 pr-3 py-2 md:py-1.5 rounded-full border border-[var(--ss-i-200)] bg-white text-sm md:text-xs text-[var(--ss-i-900)] placeholder-[var(--ss-i-400)] focus:outline-none focus:border-[var(--ss-o-400)] min-h-[40px] md:min-h-0"
            />
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-2xl border-l-4 border-rose-500 bg-rose-50 px-4 py-3 mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-rose-900">Couldn’t load delivery log</div>
              <div className="text-xs text-rose-700 mt-0.5">{error}</div>
            </div>
            <button
              type="button"
              onClick={() => fetchLogs()}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-[var(--ss-i-200)] bg-white shadow-[var(--ss-shadow)] overflow-hidden">
          {loading && !data ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-[var(--ss-i-500)]">
              <RefreshCw size={20} className="animate-spin text-[var(--ss-o-500)]" />
              <span className="text-sm">Loading delivery log…</span>
            </div>
          ) : !data || data.entries.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
              <Inbox size={32} className="text-[var(--ss-i-300)]" />
              <div>
                <div className="text-sm font-semibold text-[var(--ss-i-700)]">
                  No deliveries match these filters
                </div>
                <div className="text-xs text-[var(--ss-i-500)] mt-1">
                  Approve a report to see it appear here. Auto-refreshes every 30 seconds.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop table — unchanged */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--ss-i-50)] sticky top-0">
                    <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--ss-i-500)]">
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 font-semibold">Student</th>
                      <th className="px-4 py-2.5 font-semibold">Month</th>
                      <th className="px-4 py-2.5 font-semibold">Channel</th>
                      <th className="px-4 py-2.5 font-semibold">Recipient</th>
                      <th className="px-4 py-2.5 font-semibold">Sent</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((entry) => {
                      const isExpanded = expanded === entry.id;
                      return (
                        <RowGroup
                          key={entry.id}
                          entry={entry}
                          isExpanded={isExpanded}
                          onToggle={() => setExpanded(isExpanded ? null : entry.id)}
                          onResend={() => handleResend(entry.id)}
                          resending={resendingId === entry.id}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards — same data, stacked layout */}
              <ul className="md:hidden divide-y divide-[var(--ss-i-100)]">
                {data.entries.map((entry) => {
                  const isExpanded = expanded === entry.id;
                  return (
                    <MobileCard
                      key={entry.id}
                      entry={entry}
                      isExpanded={isExpanded}
                      onToggle={() => setExpanded(isExpanded ? null : entry.id)}
                      onResend={() => handleResend(entry.id)}
                      resending={resendingId === entry.id}
                    />
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <div className="mt-3 text-[11px] text-[var(--ss-i-400)] text-right">
          Auto-refreshes every 30s · Showing {data?.entries.length ?? 0} of {data?.total ?? 0}
        </div>
      </main>
    </div>
  );
}

function RowGroup({
  entry,
  isExpanded,
  onToggle,
  onResend,
  resending,
}: {
  entry: DeliveryLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onResend: () => void;
  resending: boolean;
}) {
  const overrideMismatch =
    entry.intended_recipient && entry.recipient && entry.intended_recipient !== entry.recipient;
  const resendLabel = entry.channel === "whatsapp" ? "Resend WhatsApp" : "Resend email";

  return (
    <>
      <tr
        className="border-t border-[var(--ss-i-100)] hover:bg-[var(--ss-i-50)] transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3 align-top">
          <StatusPill status={entry.status} />
        </td>
        <td className="px-4 py-3 align-top">
          <div className="font-semibold text-[var(--ss-i-900)]">
            {entry.student_name ?? "—"}
          </div>
          {entry.subject && (
            <div className="text-[11px] text-[var(--ss-i-500)] mt-0.5">{entry.subject}</div>
          )}
        </td>
        <td className="px-4 py-3 align-top text-[var(--ss-i-700)]">
          {prettyMonth(entry.reporting_month)}
        </td>
        <td className="px-4 py-3 align-top">
          <ChannelIcon channel={entry.channel} />
        </td>
        <td className="px-4 py-3 align-top">
          <div className="font-mono text-[12px] text-[var(--ss-i-900)] break-all">
            {entry.recipient ?? <span className="text-[var(--ss-i-400)] italic font-sans">no recipient</span>}
          </div>
          {overrideMismatch && (
            <div className="text-[10px] text-amber-700 mt-0.5 inline-flex items-center gap-1">
              <ShieldAlert size={10} />
              redirected (test mode)
            </div>
          )}
        </td>
        <td className="px-4 py-3 align-top">
          <div
            className="text-[var(--ss-i-700)]"
            title={fullTimestamp(entry.sent_at)}
          >
            {timeAgo(entry.sent_at)}
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onResend(); }}
              disabled={resending}
              title={resendLabel}
              aria-label={resendLabel}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--ss-o-50)] text-[var(--ss-o-700)] border border-[var(--ss-o-200)] hover:bg-[var(--ss-o-100)] disabled:opacity-60 transition-colors"
            >
              {resending ? (
                <RefreshCw size={11} className="animate-spin" />
              ) : (
                <Send size={11} />
              )}
              <span className="hidden sm:inline">{resending ? "Sending…" : "Resend"}</span>
            </button>
            <ChevronRight
              size={14}
              className={`text-[var(--ss-i-400)] transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-[var(--ss-bg)]">
          <td colSpan={7} className="px-4 py-3 border-t border-[var(--ss-i-100)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
              {overrideMismatch && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <div className="font-semibold text-amber-800 mb-0.5">
                    Intended recipient (parent)
                  </div>
                  <div className="font-mono text-amber-900 break-all">
                    {entry.intended_recipient}
                  </div>
                </div>
              )}
              {entry.error_msg && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <div className="font-semibold text-rose-800 mb-0.5">Error</div>
                  <div className="text-rose-900 break-words">{entry.error_msg}</div>
                </div>
              )}
              <div className="rounded-lg border border-[var(--ss-i-200)] bg-white px-3 py-2 md:col-span-2">
                <div className="font-semibold text-[var(--ss-i-700)] mb-0.5">Report ID</div>
                <div className="font-mono text-[11px] text-[var(--ss-i-500)] break-all">
                  {entry.report_id}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onResend(); }}
                disabled={resending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[var(--ss-o-500)] text-white hover:bg-[var(--ss-o-600)] disabled:opacity-60"
              >
                {resending ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                {resending ? "Sending…" : resendLabel}
              </button>
              <Link
                href={`/ptm/${entry.report_id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border border-[var(--ss-i-200)] bg-white text-[var(--ss-i-700)] hover:bg-[var(--ss-i-50)]"
                onClick={(e) => e.stopPropagation()}
              >
                Open report
              </Link>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MobileCard({
  entry,
  isExpanded,
  onToggle,
  onResend,
  resending,
}: {
  entry: DeliveryLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onResend: () => void;
  resending: boolean;
}) {
  const overrideMismatch =
    entry.intended_recipient && entry.recipient && entry.intended_recipient !== entry.recipient;
  const resendLabel = entry.channel === "whatsapp" ? "Resend WhatsApp" : "Resend email";

  return (
    <li className="px-4 py-3.5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-start gap-3 min-h-[44px]"
        aria-expanded={isExpanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <StatusPill status={entry.status} />
            <span
              className="text-[11px] text-[var(--ss-i-500)]"
              title={fullTimestamp(entry.sent_at)}
            >
              {timeAgo(entry.sent_at)}
            </span>
          </div>
          <div className="font-semibold text-[var(--ss-i-900)] truncate">
            {entry.student_name ?? "—"}
          </div>
          <div className="text-[12px] text-[var(--ss-i-500)] mt-0.5">
            {entry.subject ? `${entry.subject} · ` : ""}
            {prettyMonth(entry.reporting_month)}
          </div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <ChannelIcon channel={entry.channel} />
            <span className="text-[var(--ss-i-300)]">·</span>
            <span className="font-mono text-[11px] text-[var(--ss-i-700)] break-all min-w-0">
              {entry.recipient ?? <span className="italic font-sans text-[var(--ss-i-400)]">no recipient</span>}
            </span>
          </div>
          {overrideMismatch && (
            <div className="text-[10px] text-amber-700 mt-1 inline-flex items-center gap-1">
              <ShieldAlert size={10} />
              redirected (test mode)
            </div>
          )}
        </div>
        <ChevronRight
          size={16}
          className={`text-[var(--ss-i-400)] mt-1 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2.5 border-t border-[var(--ss-i-100)] pt-3">
          {overrideMismatch && entry.intended_recipient && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <div className="font-semibold text-amber-800 mb-0.5">Intended recipient (parent)</div>
              <div className="font-mono text-amber-900 break-all">{entry.intended_recipient}</div>
            </div>
          )}
          {entry.error_msg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs">
              <div className="font-semibold text-rose-800 mb-0.5">Error</div>
              <div className="text-rose-900 break-words">{entry.error_msg}</div>
            </div>
          )}
          <div className="rounded-xl border border-[var(--ss-i-200)] bg-white px-3 py-2 text-xs">
            <div className="font-semibold text-[var(--ss-i-700)] mb-0.5">Report ID</div>
            <div className="font-mono text-[11px] text-[var(--ss-i-500)] break-all">
              {entry.report_id}
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold bg-[var(--ss-o-500)] text-white hover:bg-[var(--ss-o-600)] disabled:opacity-60 min-h-[44px]"
            >
              {resending ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {resending ? "Sending…" : resendLabel}
            </button>
            <Link
              href={`/ptm/${entry.report_id}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border border-[var(--ss-i-200)] bg-white text-[var(--ss-i-700)] hover:bg-[var(--ss-i-50)] min-h-[44px]"
            >
              Open report
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}
