"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  Check,
  ChevronRight,
  Inbox,
  LifeBuoy,
  Mail,
  Play,
  RefreshCw,
  Search,
  ShieldOff,
} from "lucide-react";
import Navbar from "@/app/components/Navbar";
import { useToast } from "@/app/components/ToastProvider";
import { api } from "@/app/lib/api";
import type {
  Issue,
  IssueSeverity,
  IssueStatus,
  IssuesResponse,
} from "@/app/lib/api";

// Categories registered for the page. Adding a new issue type later is just
// adding an entry here + a server-side `type` value — UI auto-renders.
const CATEGORIES: {
  type: string;
  label: string;
  Icon: typeof Mail;
  description: string;
  checkLabel?: string;
  runCheck?: () => Promise<{ summary: string; opened: number }>;
}[] = [
  {
    type: "email_missing",
    label: "Email records",
    Icon: Mail,
    description:
      "Students with no parent email on record in Wise. Approving a report for them won’t deliver — these tickets surface them so the team can chase the address.",
    checkLabel: "Run email-records check",
    runCheck: async () => {
      const r = await api.issues.runEmailRecordsCheck();
      const summary =
        r.opened === 0 && r.already_open === 0
          ? `No issues found. Checked ${r.checked} student${r.checked === 1 ? "" : "s"}.`
          : `Checked ${r.checked} students — ${r.opened} new issue${r.opened === 1 ? "" : "s"} opened${
              r.already_open ? `, ${r.already_open} already open` : ""
            }.`;
      return { summary, opened: r.opened };
    },
  },
];

const STATUS_TABS: { key: IssueStatus | "all"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
  { key: "wont_fix", label: "Won’t fix" },
  { key: "all", label: "All" },
];

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

const STATUS_STYLES: Record<IssueStatus, { bg: string; text: string; border: string; label: string }> = {
  open: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", label: "Open" },
  in_progress: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", label: "In progress" },
  resolved: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Resolved" },
  wont_fix: { bg: "bg-[var(--ss-i-100)]", text: "text-[var(--ss-i-600)]", border: "border-[var(--ss-i-200)]", label: "Won’t fix" },
};

const SEVERITY_STYLES: Record<IssueSeverity, { dot: string; label: string }> = {
  high: { dot: "bg-rose-500", label: "High" },
  medium: { dot: "bg-amber-500", label: "Medium" },
  low: { dot: "bg-sky-500", label: "Low" },
};

function StatusPill({ status }: { status: IssueStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}
    >
      {s.label}
    </span>
  );
}

function SeverityDot({ severity }: { severity: IssueSeverity }) {
  const s = SEVERITY_STYLES[severity];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ss-i-500)]" title={`Severity: ${s.label}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function IssuesPage() {
  const toast = useToast();
  const [activeType, setActiveType] = useState<string>(CATEGORIES[0].type);
  const [data, setData] = useState<IssuesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "all">("open");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchIssues = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const result = await api.issues.list({
        type: activeType,
        status: statusFilter !== "all" ? statusFilter : undefined,
        q: debouncedSearch || undefined,
        limit: 200,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load issues");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeType, statusFilter, debouncedSearch]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const category = useMemo(
    () => CATEGORIES.find((c) => c.type === activeType) ?? CATEGORIES[0],
    [activeType],
  );

  const counts = data?.counts_by_type[activeType] ?? {
    open: 0,
    in_progress: 0,
    resolved: 0,
    wont_fix: 0,
  };

  async function handleRunCheck() {
    if (!category.runCheck || running) return;
    const taskId = `check-${category.type}-${Date.now()}`;
    setRunning(true);
    toast.task.start(taskId, `Running ${category.label.toLowerCase()} check…`);
    try {
      const { summary, opened } = await category.runCheck();
      toast.task.succeed(taskId, `Check finished — ${summary}`,
        opened > 0
          ? { label: "View open issues", onClick: () => { setStatusFilter("open"); fetchIssues({ silent: true }); } }
          : undefined,
      );
      await fetchIssues({ silent: true });
    } catch (e) {
      toast.task.fail(
        taskId,
        `Check failed: ${e instanceof Error ? e.message : "unknown"}`,
        { label: "Retry", onClick: () => void handleRunCheck() },
      );
    } finally {
      setRunning(false);
    }
  }

  async function transition(issue: Issue, status: IssueStatus) {
    setActingId(issue.id);
    try {
      await api.issues.update(issue.id, { status });
      toast.success(
        status === "resolved" ? `Marked “${issue.entity_name ?? "issue"}” as resolved`
        : status === "wont_fix" ? `Marked “${issue.entity_name ?? "issue"}” as won’t fix`
        : status === "in_progress" ? `Picked up “${issue.entity_name ?? "issue"}”`
        : "Reopened issue",
      );
      await fetchIssues({ silent: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update issue");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[var(--ss-o-600)] text-xs font-semibold uppercase tracking-wide mb-1">
              <LifeBuoy size={14} />
              Support
            </div>
            <h1
              className="text-2xl md:text-3xl font-bold text-[var(--ss-i-900)]"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Issues
            </h1>
            <p className="text-sm text-[var(--ss-i-500)] mt-1 max-w-xl">
              Tickets the support team works through — automatically raised when
              the system detects a problem (missing email, broken delivery, etc.)
              or manually opened by a check.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchIssues()}
            disabled={refreshing}
            className="self-start inline-flex items-center gap-1.5 px-4 py-2 md:px-3 md:py-1.5 rounded-full text-sm font-medium border border-[var(--ss-i-200)] bg-white text-[var(--ss-i-700)] hover:bg-[var(--ss-i-50)] transition-colors disabled:opacity-50 min-h-[40px] md:min-h-0"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Category nav */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {CATEGORIES.map((cat) => {
            const active = cat.type === activeType;
            const open = data?.counts_by_type[cat.type]?.open ?? 0;
            return (
              <button
                key={cat.type}
                type="button"
                onClick={() => setActiveType(cat.type)}
                className={`text-left rounded-2xl border p-4 bg-white transition-colors ${
                  active
                    ? "border-[var(--ss-o-300)] shadow-[var(--ss-shadow-brand)]"
                    : "border-[var(--ss-i-200)] hover:border-[var(--ss-i-300)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${active ? "bg-[var(--ss-o-50)] text-[var(--ss-o-600)]" : "bg-[var(--ss-i-100)] text-[var(--ss-i-500)]"}`}>
                      <cat.Icon size={16} />
                    </div>
                    <span className={`text-sm font-semibold ${active ? "text-[var(--ss-o-700)]" : "text-[var(--ss-i-900)]"}`} style={{ fontFamily: "var(--font-jakarta)" }}>
                      {cat.label}
                    </span>
                  </div>
                  {open > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      {open} open
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--ss-i-500)] leading-snug">{cat.description}</p>
              </button>
            );
          })}
        </div>

        {/* Action bar — current category */}
        <div className="rounded-2xl border border-[var(--ss-i-200)] bg-white shadow-[var(--ss-shadow)] p-4 mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--font-jakarta)" }}>
              {category.label}
            </div>
            <div className="text-[11px] text-[var(--ss-i-500)] mt-0.5">
              {counts.open} open · {counts.in_progress} in progress · {counts.resolved} resolved
            </div>
          </div>
          {category.checkLabel && (
            <button
              type="button"
              onClick={handleRunCheck}
              disabled={running}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[var(--ss-o-500)] text-white font-semibold text-sm hover:bg-[var(--ss-o-600)] disabled:opacity-60 min-h-[44px] sm:min-h-0 sm:py-2 transition-colors shadow-[var(--ss-shadow-brand)]"
            >
              {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              {running ? "Started — see toast" : category.checkLabel}
            </button>
          )}
        </div>

        {/* Filters */}
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
          <div className="w-full md:flex-1 md:min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ss-i-400)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, student, or description…"
              className="w-full pl-8 pr-3 py-2 md:py-1.5 rounded-full border border-[var(--ss-i-200)] bg-white text-sm md:text-xs text-[var(--ss-i-900)] placeholder-[var(--ss-i-400)] focus:outline-none focus:border-[var(--ss-o-400)] min-h-[40px] md:min-h-0"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border-l-4 border-rose-500 bg-rose-50 px-4 py-3 mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-rose-900">Couldn’t load issues</div>
              <div className="text-xs text-rose-700 mt-0.5">{error}</div>
            </div>
            <button
              type="button"
              onClick={() => fetchIssues()}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* List */}
        <div className="rounded-2xl border border-[var(--ss-i-200)] bg-white shadow-[var(--ss-shadow)] overflow-hidden">
          {loading && !data ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-[var(--ss-i-500)]">
              <RefreshCw size={20} className="animate-spin text-[var(--ss-o-500)]" />
              <span className="text-sm">Loading issues…</span>
            </div>
          ) : !data || data.entries.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
              <Inbox size={32} className="text-[var(--ss-i-300)]" />
              <div>
                <div className="text-sm font-semibold text-[var(--ss-i-700)]">
                  {statusFilter === "open" ? "No open issues here" : "No issues match these filters"}
                </div>
                <div className="text-xs text-[var(--ss-i-500)] mt-1 max-w-sm">
                  {category.checkLabel
                    ? "Run a check to scan the data for problems, or wait for issues to be raised automatically when reports are approved."
                    : "Issues raised by the system will show up here."}
                </div>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--ss-i-100)]">
              {data.entries.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  busy={actingId === issue.id}
                  onAction={(s) => transition(issue, s)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 text-[11px] text-[var(--ss-i-400)] text-right">
          Showing {data?.entries.length ?? 0} of {data?.total ?? 0}
        </div>
      </main>
    </div>
  );
}

function IssueRow({
  issue,
  busy,
  onAction,
}: {
  issue: Issue;
  busy: boolean;
  onAction: (s: IssueStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const created = timeAgo(issue.created_at);

  return (
    <li className="px-4 py-3.5 md:px-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-start gap-3"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <StatusPill status={issue.status} />
            <SeverityDot severity={issue.severity} />
            <span className="text-[11px] text-[var(--ss-i-400)]">· {created}</span>
          </div>
          <div className="text-sm font-semibold text-[var(--ss-i-900)] truncate">
            {issue.title}
          </div>
          {issue.entity_name && (
            <div className="text-[12px] text-[var(--ss-i-500)] mt-0.5 truncate">
              {issue.entity_type ?? "entity"}: {issue.entity_name}
            </div>
          )}
        </div>
        <ChevronRight
          size={16}
          className={`mt-1 shrink-0 text-[var(--ss-i-400)] transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-[var(--ss-i-100)] space-y-3">
          {issue.description && (
            <p className="text-[13px] text-[var(--ss-i-700)] leading-relaxed whitespace-pre-line">
              {issue.description}
            </p>
          )}
          {issue.metadata && (
            <div className="rounded-xl border border-[var(--ss-i-200)] bg-[var(--ss-bg)] px-3 py-2 text-[11px]">
              <div className="font-semibold text-[var(--ss-i-700)] mb-1">Metadata</div>
              <pre className="font-mono text-[10px] text-[var(--ss-i-600)] whitespace-pre-wrap break-all">
                {JSON.stringify(issue.metadata, null, 2)}
              </pre>
            </div>
          )}
          {issue.resolution_note && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
              <div className="font-semibold mb-0.5">Resolution note</div>
              {issue.resolution_note}
            </div>
          )}
          {issue.status !== "resolved" && issue.status !== "wont_fix" && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAction("resolved")}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-60 min-h-[40px]"
              >
                <Check size={13} />
                Mark resolved
              </button>
              <button
                type="button"
                onClick={() => onAction("wont_fix")}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-white border border-[var(--ss-i-200)] text-[var(--ss-i-700)] hover:bg-[var(--ss-i-50)] disabled:opacity-60 min-h-[40px]"
              >
                <ShieldOff size={13} />
                Won’t fix
              </button>
              {issue.status === "open" && (
                <button
                  type="button"
                  onClick={() => onAction("in_progress")}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 disabled:opacity-60 min-h-[40px]"
                >
                  <AlertOctagon size={13} />
                  Working on it
                </button>
              )}
            </div>
          )}
          {(issue.status === "resolved" || issue.status === "wont_fix") && (
            <button
              type="button"
              onClick={() => onAction("open")}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-white border border-[var(--ss-i-200)] text-[var(--ss-i-700)] hover:bg-[var(--ss-i-50)] disabled:opacity-60 min-h-[40px]"
            >
              Reopen
            </button>
          )}
        </div>
      )}
    </li>
  );
}
