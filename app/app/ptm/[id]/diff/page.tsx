"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, AlertCircle, RefreshCw, Layers } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import ReportDiffViewer from "@/app/components/ReportDiffViewer";
import type { ReportVersion, ReportVersionMeta } from "@/app/lib/mock-data";
import { api } from "@/app/lib/api";

const TRIGGER_LABEL: Record<string, string> = {
  initial: "Initial draft",
  regenerate: "Regeneration",
  edit: "Teacher edit",
  tone_change: "Tone change",
  override: "Manager override",
};

export default function DiffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [versions, setVersions] = useState<ReportVersionMeta[]>([]);
  const [pair, setPair] = useState<{ before: ReportVersion | null; after: ReportVersion } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [beforeNum, setBeforeNum] = useState<number | null>(null);
  const [afterNum, setAfterNum] = useState<number | null>(null);

  async function fetchData(b?: number, a?: number) {
    setLoading(true);
    setError(null);
    try {
      const [vlist, diff] = await Promise.all([
        api.reports.listVersions(id),
        api.reports.diff(id, { before: b, after: a }),
      ]);
      setVersions(vlist);
      setPair(diff);
      setBeforeNum(diff.before?.version_number ?? null);
      setAfterNum(diff.after.version_number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load diff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function pickPair(b: number | null, a: number) {
    setBeforeNum(b);
    setAfterNum(a);
    void fetchData(b ?? undefined, a);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <Link
          href={`/ptm/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--ss-i-400)] hover:text-[var(--ss-i-700)] transition-colors mb-5"
        >
          <ArrowLeft size={14} /> Back to report
        </Link>

        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ss-i-500)] mb-1">
              Report History
            </p>
            <h1
              className="text-2xl font-extrabold text-[var(--ss-i-900)] flex items-center gap-2"
              style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}
            >
              <Layers size={20} className="text-[var(--ss-o-500)]" />
              Regeneration Diff
            </h1>
            <p className="text-sm text-[var(--ss-i-500)] mt-1">
              Compare two versions of this report — additions in green, removals in red.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-10 bg-white border border-[var(--ss-i-200)] rounded-2xl animate-pulse" />
            <div className="h-64 bg-white border border-[var(--ss-i-200)] rounded-2xl animate-pulse" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border-l-4 border-l-[var(--ss-error)] border border-[var(--ss-i-200)] p-5 shadow-[var(--ss-shadow)] flex items-start gap-3">
            <AlertCircle size={16} className="text-[var(--ss-error)] mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--ss-i-900)] mb-1">{error}</p>
              <button
                onClick={() => void fetchData()}
                className="text-xs font-semibold text-[var(--ss-o-600)] inline-flex items-center gap-1"
              >
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          </div>
        ) : versions.length < 2 || !pair ? (
          <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] p-10 text-center shadow-[var(--ss-shadow)]">
            <Layers size={28} className="mx-auto text-[var(--ss-i-300)] mb-3" />
            <p className="text-sm font-bold text-[var(--ss-i-900)] mb-1">
              Only one version exists yet.
            </p>
            <p className="text-xs text-[var(--ss-i-500)]">
              The diff view becomes useful after a regeneration, edit, or tone change.
            </p>
          </div>
        ) : (
          <>
            {/* Version timeline */}
            <div className="mb-5 bg-white border border-[var(--ss-i-200)] rounded-2xl shadow-[var(--ss-shadow)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ss-i-500)] mb-3">
                Versions ({versions.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {versions.map((v) => {
                  const isAfter = v.version_number === afterNum;
                  const isBefore = v.version_number === beforeNum;
                  return (
                    <motion.button
                      key={v.id}
                      type="button"
                      whileHover={{ y: -1 }}
                      onClick={() => {
                        if (v.version_number === afterNum) return;
                        pickPair(v.version_number - 1 > 0 ? v.version_number - 1 : null, v.version_number);
                      }}
                      className={`relative px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                        isAfter
                          ? "bg-[var(--ss-o-500)] text-white border-[var(--ss-o-500)] shadow-[var(--ss-shadow-brand)]"
                          : isBefore
                          ? "bg-[var(--ss-i-100)] text-[var(--ss-i-700)] border-[var(--ss-i-200)]"
                          : "bg-white text-[var(--ss-i-500)] border-[var(--ss-i-200)] hover:bg-[var(--ss-i-100)]"
                      }`}
                    >
                      v{v.version_number} · {TRIGGER_LABEL[v.trigger] ?? v.trigger}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <ReportDiffViewer
              before={pair.before?.draft_content ?? null}
              after={pair.after.draft_content}
              beforeLabel={
                pair.before
                  ? `v${pair.before.version_number} · ${TRIGGER_LABEL[pair.before.trigger] ?? pair.before.trigger}`
                  : "First version"
              }
              afterLabel={`v${pair.after.version_number} · ${TRIGGER_LABEL[pair.after.trigger] ?? pair.after.trigger}`}
            />
          </>
        )}
      </main>
    </div>
  );
}
