"use client";

import { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { api } from "@/app/lib/api";
import { Bot, CheckCircle2, AlertCircle, Play, Loader2 } from "lucide-react";

interface TeacherRow {
  teacher_name: string;
  auto_generate_enabled: boolean;
}

interface RunResult {
  month: string;
  batch_size: number;
  processed: { report_id: string; student_id: string; student_name: string; teacher_name?: string }[];
  skipped_existing: string[];
  skipped_no_optin: string[];
  remaining: number;
  note?: string;
}

export default function AutomationPage() {
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [filter, setFilter] = useState("");
  const [busyTeacher, setBusyTeacher] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [batchSize, setBatchSize] = useState(20);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  async function load() {
    setError(null);
    try {
      const rows = await api.teachers.listAutoGenerate();
      rows.sort((a, b) => a.teacher_name.localeCompare(b.teacher_name));
      setTeachers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load teachers");
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggle(teacher_name: string, next: boolean) {
    setBusyTeacher(teacher_name);
    setError(null);
    setTeachers((prev) =>
      prev ? prev.map((t) => (t.teacher_name === teacher_name ? { ...t, auto_generate_enabled: next } : t)) : prev
    );
    try {
      await api.teachers.setAutoGenerate(teacher_name, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      // revert
      setTeachers((prev) =>
        prev ? prev.map((t) => (t.teacher_name === teacher_name ? { ...t, auto_generate_enabled: !next } : t)) : prev
      );
    } finally {
      setBusyTeacher(null);
    }
  }

  async function runNow() {
    setRunning(true);
    setError(null);
    try {
      const res = await api.autoGenerate.run(undefined, batchSize);
      setLastRun(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  const enabledCount = teachers?.filter((t) => t.auto_generate_enabled).length ?? 0;
  const totalCount = teachers?.length ?? 0;
  const visibleTeachers = (teachers ?? []).filter((t) =>
    !filter ? true : t.teacher_name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-6 md:p-7">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--ss-o-50)] flex items-center justify-center flex-shrink-0">
              <Bot size={20} className="text-[var(--ss-o-600)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--font-jakarta)" }}>
                Report Automation
              </h1>
              <p className="text-sm text-[var(--ss-i-500)] mt-1 leading-relaxed">
                Pick which teachers want their monthly reports auto-generated each day.
                The n8n cron job hits <code className="text-xs bg-[var(--ss-i-100)] px-1.5 py-0.5 rounded">/api/ptm/auto-generate/run</code>{" "}
                daily and processes a batch of opted-in students — defaults are used (balanced tone, no overrides).
              </p>
              <p className="mt-3 text-xs text-[var(--ss-i-400)]">
                <span className="font-semibold text-[var(--ss-i-700)]">{enabledCount}</span> of {totalCount} teachers opted in
              </p>
            </div>
          </div>
        </div>

        {/* Manual run */}
        <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-5 md:p-6">
          <h2 className="text-sm font-bold text-[var(--ss-i-900)] mb-3" style={{ fontFamily: "var(--font-jakarta)" }}>
            Run a batch now
          </h2>
          <p className="text-xs text-[var(--ss-i-500)] leading-relaxed mb-4">
            Generate reports immediately for opted-in teachers (skips students that already have a report this month).
            Useful for testing the schedule before the n8n job runs.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--ss-i-700)]">
              Batch size
              <input
                type="number"
                min={1}
                max={100}
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                className="w-20 px-2 py-1.5 rounded-lg border border-[var(--ss-i-200)] text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)]"
              />
            </label>
            <button
              onClick={runNow}
              disabled={running || enabledCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-semibold hover:bg-[var(--ss-o-600)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[var(--ss-shadow-brand)]"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {running ? "Generating…" : "Run now"}
            </button>
            {enabledCount === 0 && (
              <span className="text-[11px] text-[var(--ss-i-400)]">Opt in at least one teacher below first.</span>
            )}
          </div>

          {lastRun && (
            <div className="mt-4 rounded-xl bg-[var(--ss-bg)] border border-[var(--ss-i-200)] p-4 text-xs">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={13} className="text-[var(--ss-o-600)]" />
                <p className="font-semibold text-[var(--ss-i-800)]">
                  {lastRun.processed.length} created · {lastRun.skipped_existing.length} skipped (already exists) · {lastRun.remaining} remaining for tomorrow
                </p>
              </div>
              <p className="text-[11px] text-[var(--ss-i-400)]">Month: {lastRun.month}</p>
              {lastRun.note && <p className="text-[11px] text-[var(--ss-i-500)] mt-1">{lastRun.note}</p>}
              {lastRun.processed.length > 0 && (
                <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {lastRun.processed.slice(0, 20).map((p) => (
                    <li key={p.report_id} className="text-[11px] text-[var(--ss-i-600)]">
                      • {p.student_name} <span className="text-[var(--ss-i-400)]">({p.teacher_name})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Teacher list */}
        <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--font-jakarta)" }}>
              Teachers
            </h2>
            <input
              type="text"
              placeholder="Search teachers…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 rounded-full border border-[var(--ss-i-200)] text-xs text-[var(--ss-i-700)] placeholder:text-[var(--ss-i-400)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)]"
            />
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-[var(--ss-error)] bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          {teachers === null ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-[var(--ss-i-100)] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : visibleTeachers.length === 0 ? (
            <p className="text-xs text-[var(--ss-i-400)] py-4 text-center">No teachers match.</p>
          ) : (
            <ul className="divide-y divide-[var(--ss-i-100)]">
              {visibleTeachers.map((t) => (
                <li key={t.teacher_name} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-[var(--ss-i-800)] font-medium">{t.teacher_name}</span>
                  <Toggle
                    enabled={t.auto_generate_enabled}
                    onChange={(v) => void toggle(t.teacher_name, v)}
                    disabled={busyTeacher === t.teacher_name}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? "bg-[var(--ss-o-500)]" : "bg-[var(--ss-i-200)]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
