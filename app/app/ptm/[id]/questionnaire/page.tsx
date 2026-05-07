"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, X, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import { type QuestionnaireQuestion } from "@/app/lib/mock-data";
import { api } from "@/app/lib/api";

const SUGGESTED_TOPICS = [
  "Quadratic formula", "Graphing parabolas", "Polynomials", "Analytical writing",
  "Dictionaries and sets", "Endgame basics", "Geometric proofs", "Advanced vocabulary",
];

export default function QuestionnairePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [engagement, setEngagement] = useState<number | null>(null);
  const [concept, setConcept] = useState<number | null>(null);
  const [application, setApplication] = useState<number | null>(null);
  const [topicsCorrection, setTopicsCorrection] = useState("");
  const [nextMonthTopics, setNextMonthTopics] = useState<string[]>([]);
  const [freeForm, setFreeForm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function fetchQuestions() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.reports.getQuestionnaire(id);
      setQuestions(data.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questionnaire");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchQuestions(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
        <Navbar />
        <main className="max-w-xl mx-auto px-4 py-8">
          <div className="h-4 w-24 rounded bg-[var(--ss-i-200)] animate-pulse mb-6" />
          <div className="h-8 w-64 rounded bg-[var(--ss-i-200)] animate-pulse mb-3" />
          <div className="h-4 w-full rounded bg-[var(--ss-i-100)] animate-pulse mb-8" />
          <div className="h-2 w-full rounded-full bg-[var(--ss-i-200)] animate-pulse mb-8" />
          <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] p-6 space-y-3">
            <div className="h-6 w-3/4 rounded bg-[var(--ss-i-100)] animate-pulse" />
            <div className="h-4 w-full rounded bg-[var(--ss-i-100)] animate-pulse" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-[var(--ss-i-100)] animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
        <Navbar />
        <main className="max-w-xl mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl border-l-4 border-l-[var(--ss-error)] border border-[var(--ss-i-200)] p-6 shadow-[var(--ss-shadow)]">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle size={18} className="text-[var(--ss-error)] mt-0.5 shrink-0" />
              <div>
                <h2 className="font-bold text-[var(--ss-i-900)] mb-1" style={{ fontFamily: "var(--font-jakarta)" }}>Failed to load questionnaire</h2>
                <p className="text-sm text-[var(--ss-i-500)]">{error}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/ptm/${id}`} className="text-sm font-semibold text-[var(--ss-o-600)] hover:underline">← Back to report</Link>
              <button onClick={fetchQuestions} className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)]">
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
        <Navbar />
        <main className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-[var(--ss-i-500)] text-sm mb-4">No questions available for this report.</p>
          <Link href={`/ptm/${id}`} className="text-sm font-semibold text-[var(--ss-o-600)] hover:underline">← Back to report</Link>
        </main>
      </div>
    );
  }

  const currentQ = questions[step];
  const isLast = step === questions.length - 1;

  function toggleTopic(topic: string) {
    setNextMonthTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : prev.length < 4 ? [...prev, topic] : prev
    );
  }

  function canProceed() {
    switch (currentQ.type) {
      case "dropdown_engagement": return engagement !== null;
      case "dropdown_concept": return concept !== null;
      case "dropdown_application": return application !== null;
      case "topics_correction": return topicsCorrection.trim().length > 0;
      case "next_month_plan": return true;
      case "free_form": return true;
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = await api.reports.submitQuestionnaire(id, {
        engagement_rating: engagement ?? undefined,
        concept_rating: concept ?? undefined,
        application_rating: application ?? undefined,
        topics_correction: topicsCorrection || undefined,
        next_month_topics: nextMonthTopics.length > 0 ? nextMonthTopics : undefined,
        free_form_note: freeForm || undefined,
      });
      if (result.status === "escalated") {
        router.push("/ptm");
      } else {
        router.push(`/ptm/${id}`);
      }
    } catch {
      router.push(`/ptm/${id}`);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-8">
        <Link href={`/ptm/${id}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--ss-i-400)] hover:text-[var(--ss-i-700)] transition-colors mb-6">
          <ArrowLeft size={14} />Back to Report
        </Link>

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ss-o-600)] mb-1.5">Request Changes</p>
          <h1 className="text-2xl font-extrabold text-[var(--ss-i-900)] mb-2" style={{ fontFamily: "var(--font-jakarta)" }}>
            Help us improve the report
          </h1>
          <p className="text-sm text-[var(--ss-i-400)]">
            Answering a few questions will help Claude regenerate a more accurate report.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-[var(--ss-i-400)] mb-2">
            <span>Question {step + 1} of {questions.length}</span>
            <span>{Math.round(((step + 1) / questions.length) * 100)}% complete</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[var(--ss-i-200)] overflow-hidden">
            <div className="h-1.5 rounded-full bg-[var(--ss-o-500)] transition-all duration-300" style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        {/* Question card */}
        <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-6 md:p-7 mb-4">
          <h2 className="text-lg font-bold text-[var(--ss-i-900)] mb-1.5" style={{ fontFamily: "var(--font-jakarta)" }}>{currentQ.label}</h2>
          {currentQ.description && <p className="text-xs text-[var(--ss-i-400)] mb-5 leading-relaxed">{currentQ.description}</p>}
          {!currentQ.description && <div className="mb-5" />}

          {/* Dropdown types */}
          {(currentQ.type === "dropdown_engagement" || currentQ.type === "dropdown_concept" || currentQ.type === "dropdown_application") && (
            <div className="space-y-2">
              {currentQ.options!.map((opt) => {
                const val = currentQ.type === "dropdown_engagement" ? engagement : currentQ.type === "dropdown_concept" ? concept : application;
                const setter = currentQ.type === "dropdown_engagement" ? setEngagement : currentQ.type === "dropdown_concept" ? setConcept : setApplication;
                const selected = val === opt.value;
                return (
                  <label key={opt.value} className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${selected ? "border-[var(--ss-o-400)] bg-[var(--ss-o-50)] shadow-sm" : "border-[var(--ss-i-200)] hover:border-[var(--ss-o-200)] hover:bg-[var(--ss-o-50)]/50"}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-[var(--ss-o-500)] bg-[var(--ss-o-500)]" : "border-[var(--ss-i-300)]"}`}>
                      {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm text-[var(--ss-i-700)]">{opt.label}</span>
                    <input type="radio" className="sr-only" checked={selected} onChange={() => setter(opt.value)} />
                  </label>
                );
              })}
            </div>
          )}

          {currentQ.type === "topics_correction" && (
            <textarea
              value={topicsCorrection}
              onChange={(e) => setTopicsCorrection(e.target.value)}
              rows={3}
              placeholder="e.g. Quadratic formula, completing the square, discriminant and nature of roots"
              className="w-full px-4 py-3 rounded-xl border border-[var(--ss-i-200)] bg-white text-sm text-[var(--ss-i-700)] placeholder:text-[var(--ss-i-300)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] resize-none transition"
            />
          )}

          {currentQ.type === "next_month_plan" && (
            <div>
              <p className="text-xs text-[var(--ss-i-400)] mb-3">Select up to 4 topics. ({nextMonthTopics.length}/4 selected)</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_TOPICS.map((topic) => {
                  const selected = nextMonthTopics.includes(topic);
                  const disabled = !selected && nextMonthTopics.length >= 4;
                  return (
                    <button key={topic} type="button" onClick={() => toggleTopic(topic)} disabled={disabled}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selected ? "bg-[var(--ss-o-500)] text-white border-[var(--ss-o-500)] shadow-sm" : disabled ? "bg-[var(--ss-i-100)] text-[var(--ss-i-300)] border-[var(--ss-i-200)] cursor-not-allowed" : "bg-white text-[var(--ss-i-600)] border-[var(--ss-i-200)] hover:border-[var(--ss-o-300)] hover:bg-[var(--ss-o-50)]"}`}
                    >
                      {selected && <X size={10} />}{topic}
                    </button>
                  );
                })}
              </div>
              {nextMonthTopics.length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-[var(--ss-i-100)] text-xs text-[var(--ss-i-500)]">
                  <strong className="text-[var(--ss-i-700)]">Selected:</strong> {nextMonthTopics.join(", ")}
                </div>
              )}
            </div>
          )}

          {currentQ.type === "free_form" && (
            <div>
              <textarea
                value={freeForm}
                onChange={(e) => setFreeForm(e.target.value)}
                rows={4}
                placeholder="Leave blank if everything looks correct — this question is optional."
                className="w-full px-4 py-3 rounded-xl border border-[var(--ss-i-200)] bg-white text-sm text-[var(--ss-i-700)] placeholder:text-[var(--ss-i-300)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] resize-none transition"
              />
              <p className="text-xs text-[var(--ss-i-300)] mt-2">Optional</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-[var(--ss-i-200)] text-sm text-[var(--ss-i-600)] font-medium hover:bg-white hover:border-[var(--ss-i-300)] transition-colors"
            >
              <ArrowLeft size={14} />Previous
            </button>
          )}
          <div className="flex-1" />
          {!isLast ? (
            <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[var(--ss-i-900)] text-white text-sm font-semibold hover:bg-[var(--ss-i-700)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Next<ChevronRight size={14} />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-semibold hover:bg-[var(--ss-o-600)] disabled:opacity-60 transition-all shadow-[var(--ss-shadow-brand)]"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              {submitting ? (
                <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Getting things ready…</>
              ) : (
                <>Submit &amp; Regenerate<ArrowRight size={14} /></>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
