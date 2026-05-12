"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
} from "lucide-react";
import Navbar from "@/app/components/Navbar";
import { api, type Issue, type IssueStatus } from "@/app/lib/api";
import { getAuth } from "@/app/lib/auth";

const STATUS_PILL: Record<IssueStatus, { label: string; pill: string; dot: string }> = {
  open: {
    label: "Open",
    pill: "bg-[var(--ss-o-50)] text-[var(--ss-o-700)] border border-[var(--ss-o-200)]",
    dot: "bg-[var(--ss-o-500)]",
  },
  in_progress: {
    label: "In progress",
    pill: "bg-amber-50 text-amber-700 border border-amber-200",
    dot: "bg-amber-500",
  },
  resolved: {
    label: "Resolved",
    pill: "bg-green-50 text-green-700 border border-green-200",
    dot: "bg-green-500",
  },
  wont_fix: {
    label: "Won't fix",
    pill: "bg-[var(--ss-i-100)] text-[var(--ss-i-600)] border border-[var(--ss-i-200)]",
    dot: "bg-[var(--ss-i-400)]",
  },
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

export default function SupportPage() {
  const router = useRouter();

  // Gate: teachers only. Admins use the Issues page instead.
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [teacherName, setTeacherName] = useState<string>("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  const [complaints, setComplaints] = useState<Issue[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    if (auth?.role === "teacher" && auth.teacher_name) {
      setTeacherName(auth.teacher_name);
      setAllowed(true);
    } else {
      setAllowed(false);
      router.replace("/ptm");
    }
  }, [router]);

  const fetchComplaints = useCallback(async (name: string) => {
    setListError(null);
    try {
      const data = await api.support.listMy(name);
      setComplaints(data);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load your complaints");
    }
  }, []);

  useEffect(() => {
    if (allowed !== true || !teacherName) return;
    void fetchComplaints(teacherName);
  }, [allowed, teacherName, fetchComplaints]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Add a short subject so the team knows what it's about.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.support.createComplaint({
        teacher_name: teacherName,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setTitle("");
      setDescription("");
      setSuccessOpen(true);
      // Refresh the list in the background while the success card is shown.
      void fetchComplaints(teacherName);
      // Auto-dismiss the success card.
      window.setTimeout(() => setSuccessOpen(false), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit your issue. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (allowed !== true) {
    return (
      <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
        <Navbar />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      {/* Success overlay — fixed, doesn't shift the form. */}
      <AnimatePresence>
        {successOpen && (
          <motion.div
            key="success-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="bg-white rounded-2xl shadow-[var(--ss-shadow-lg)] border border-[var(--ss-i-200)] px-6 py-5 max-w-sm w-full pointer-events-auto"
            >
              <div className="flex items-start gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.08, type: "spring", stiffness: 360, damping: 18 }}
                  className="w-11 h-11 rounded-full bg-green-50 flex items-center justify-center shrink-0"
                >
                  <CheckCircle2 size={22} className="text-green-600" />
                </motion.div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-bold text-[var(--ss-i-900)]"
                    style={{ fontFamily: "var(--font-jakarta)" }}
                  >
                    Your issue is raised
                  </p>
                  <p className="text-xs text-[var(--ss-i-500)] mt-1 leading-relaxed">
                    The support team will look into it soon. You can track its status below.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-6 md:p-7">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--ss-o-50)] flex items-center justify-center flex-shrink-0">
              <MessageSquare size={20} className="text-[var(--ss-o-600)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1
                className="text-xl md:text-2xl font-extrabold text-[var(--ss-i-900)]"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                Support
              </h1>
              <p className="text-sm text-[var(--ss-i-500)] mt-1 leading-relaxed">
                Raise an issue you're running into — broken data, a stuck approval, a
                missing student, anything. The support team picks these up directly.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-5 md:p-6"
        >
          <h2
            className="text-sm font-bold text-[var(--ss-i-900)] mb-3"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            Raise an issue
          </h2>

          <label className="block text-xs font-semibold text-[var(--ss-i-500)] uppercase tracking-wide mb-1.5">
            Subject
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Generate page didn't load for one of my students"
            maxLength={140}
            className="w-full px-3.5 py-2.5 rounded-2xl border border-[var(--ss-i-200)] bg-white text-sm text-[var(--ss-i-900)] placeholder:text-[var(--ss-i-400)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] transition-all"
          />

          <label className="block text-xs font-semibold text-[var(--ss-i-500)] uppercase tracking-wide mt-4 mb-1.5">
            What happened?
            <span className="ml-1 text-[10px] font-medium text-[var(--ss-i-400)] normal-case tracking-normal">(optional but helpful)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any steps, student names, error messages, or screenshots links that help the team reproduce it."
            rows={5}
            className="w-full px-3.5 py-2.5 rounded-2xl border border-[var(--ss-i-200)] bg-white text-sm text-[var(--ss-i-900)] placeholder:text-[var(--ss-i-400)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] transition-all resize-y"
          />

          {error && (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[var(--ss-error)] bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] text-[var(--ss-i-400)]">
              Raised as <span className="font-semibold text-[var(--ss-i-700)]">{teacherName}</span>
            </p>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-semibold hover:bg-[var(--ss-o-600)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[var(--ss-shadow-brand)]"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {submitting ? "Submitting…" : "Submit issue"}
            </button>
          </div>
        </form>

        {/* History */}
        <section className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2
              className="text-sm font-bold text-[var(--ss-i-900)]"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Your issues
            </h2>
            <button
              type="button"
              onClick={() => fetchComplaints(teacherName)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)]"
            >
              <RefreshCw size={11} />
              Refresh
            </button>
          </div>

          {listError ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ss-error)] bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={13} />
              {listError}
            </div>
          ) : complaints === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-[var(--ss-i-100)] animate-pulse" />
              ))}
            </div>
          ) : complaints.length === 0 ? (
            <p className="text-xs text-[var(--ss-i-400)] py-6 text-center">
              No issues raised yet. Anything you submit will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--ss-i-100)]">
              {complaints.map((c) => {
                const pill = STATUS_PILL[c.status];
                return (
                  <li key={c.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold text-[var(--ss-i-900)] truncate"
                        style={{ fontFamily: "var(--font-jakarta)" }}
                      >
                        {c.title}
                      </p>
                      {c.description && (
                        <p className="text-xs text-[var(--ss-i-500)] mt-1 leading-relaxed whitespace-pre-line">
                          {c.description}
                        </p>
                      )}
                      <p className="text-[11px] text-[var(--ss-i-400)] mt-1.5">
                        {fmtTime(c.created_at)}
                        {c.resolved_at && c.status === "resolved" && (
                          <> · resolved {fmtTime(c.resolved_at)}</>
                        )}
                      </p>
                      {c.resolution_note && (
                        <p className="text-[11px] italic text-[var(--ss-i-600)] mt-1.5 px-3 py-1.5 rounded-lg bg-[var(--ss-bg)] border border-[var(--ss-i-200)]">
                          Support: {c.resolution_note}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${pill.pill}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
                      {pill.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
