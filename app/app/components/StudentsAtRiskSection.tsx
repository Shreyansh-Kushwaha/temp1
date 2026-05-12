"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import type { StudentRiskGroup } from "@/app/lib/mock-data";
import { api } from "@/app/lib/api";
import { getAuth } from "@/app/lib/auth";
import RiskCard from "@/app/components/RiskCard";

export default function StudentsAtRiskSection() {
  const [groups, setGroups] = useState<StudentRiskGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchGroups() {
    setLoading(true);
    setError(null);
    try {
      // Scope teachers to their own students; admin sees everyone.
      const auth = getAuth();
      const teacher_name =
        auth?.role === "teacher" && auth.teacher_name ? auth.teacher_name : undefined;
      const data = await api.risk.studentsAtRisk(undefined, teacher_name);
      setGroups(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load risk signals");
    } finally {
      setLoading(false);
    }
  }

  async function recompute() {
    setRefreshing(true);
    try {
      await api.risk.recompute();
      await fetchGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to recompute");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchGroups();
  }, []);

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ss-i-500)] mb-1">
            Risk Detection
          </p>
          <h2
            className="text-xl font-extrabold text-[var(--ss-i-900)] flex items-center gap-2"
            style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em" }}
          >
            <AlertTriangle size={18} className="text-amber-500" />
            Students Requiring Attention
          </h2>
        </div>
        <button
          type="button"
          onClick={recompute}
          disabled={refreshing}
          className="text-xs font-semibold text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)] inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          {refreshing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          Recompute
        </button>
      </div>

      {loading && !groups ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 bg-white border border-[var(--ss-i-200)] rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white border-l-4 border-l-[var(--ss-error)] border border-[var(--ss-i-200)] rounded-2xl p-4 text-sm text-[var(--ss-i-600)]">
          {error}
        </div>
      ) : !groups || groups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white border border-[var(--ss-i-200)] rounded-2xl p-6 text-center shadow-[var(--ss-shadow)]"
        >
          <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-2">
            <span className="text-emerald-600 text-lg">✓</span>
          </div>
          <p className="text-sm font-bold text-[var(--ss-i-900)]">
            No students at risk right now.
          </p>
          <p className="text-xs text-[var(--ss-i-500)] mt-1">
            We&apos;ll surface trends here as new reports come in.
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {groups.map((g) => (
            <motion.div
              key={g.student_id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <RiskCard group={g} href={`/ptm/students/${g.student_id}`} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  );
}
