"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Tag, X } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import { MOCK_REPORTS, getQuestionsForReport, type QuestionnaireQuestion } from "@/app/lib/mock-data";

export default function QuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const report = MOCK_REPORTS.find((r) => r.id === id);

  const [engagement, setEngagement] = useState<number | null>(null);
  const [concept, setConcept] = useState<number | null>(null);
  const [application, setApplication] = useState<number | null>(null);
  const [topicsCorrection, setTopicsCorrection] = useState("");
  const [nextMonthTopics, setNextMonthTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [freeForm, setFreeForm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ss-bg)" }}>
        <p className="text-[var(--ss-i-500)]">Report not found.</p>
      </div>
    );
  }

  const questions = getQuestionsForReport(report);

  function addTopic() {
    const t = topicInput.trim();
    if (t && nextMonthTopics.length < 4 && !nextMonthTopics.includes(t)) {
      setNextMonthTopics((prev) => [...prev, t]);
      setTopicInput("");
    }
  }

  function removeTopic(topic: string) {
    setNextMonthTopics((prev) => prev.filter((t) => t !== topic));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    // Simulate regeneration delay
    await new Promise((r) => setTimeout(r, 2000));
    router.push(`/ptm/${id}`);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 md:px-8 py-8">
        <Link
          href={`/ptm/${id}`}
          className="flex items-center gap-1.5 text-sm text-[var(--ss-i-500)] hover:text-[var(--ss-i-900)] transition-colors mb-6"
        >
          <ArrowLeft size={15} />
          Back to report
        </Link>

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ss-o-600)] mb-1">
            Request Changes
          </p>
          <h1 className="text-2xl font-bold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--ss-font-display)" }}>
            Help us fix {report.draft_content.header.student_name}&apos;s report
          </h1>
          <p className="mt-1.5 text-sm text-[var(--ss-i-500)]">
            Answer {questions.length} quick question{questions.length > 1 ? "s" : ""} — only the sections the agent was unsure about.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {questions.map((q, i) => (
            <QuestionCard key={i} index={i} total={questions.length} question={q}>
              {q.type === "dropdown_engagement" && (
                <DropdownField
                  options={q.options!}
                  value={engagement}
                  onChange={setEngagement}
                />
              )}
              {q.type === "dropdown_concept" && (
                <DropdownField
                  options={q.options!}
                  value={concept}
                  onChange={setConcept}
                />
              )}
              {q.type === "dropdown_application" && (
                <DropdownField
                  options={q.options!}
                  value={application}
                  onChange={setApplication}
                />
              )}
              {q.type === "topics_correction" && (
                <textarea
                  value={topicsCorrection}
                  onChange={(e) => setTopicsCorrection(e.target.value)}
                  rows={2}
                  placeholder="e.g. Quadratic formula, completing the square, discriminant"
                  className="w-full px-4 py-3 rounded-[10px] border border-[var(--ss-i-300)] bg-white text-[var(--ss-i-900)] placeholder-[var(--ss-i-400)] focus:border-[var(--ss-o-500)] focus:ring-2 focus:ring-[var(--ss-o-200)] outline-none transition text-sm resize-none"
                />
              )}
              {q.type === "next_month_plan" && (
                <div>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
                      placeholder="Type a topic and press Enter"
                      disabled={nextMonthTopics.length >= 4}
                      className="flex-1 px-4 py-2.5 rounded-[10px] border border-[var(--ss-i-300)] bg-white text-[var(--ss-i-900)] placeholder-[var(--ss-i-400)] focus:border-[var(--ss-o-500)] focus:ring-2 focus:ring-[var(--ss-o-200)] outline-none transition text-sm disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={addTopic}
                      disabled={!topicInput.trim() || nextMonthTopics.length >= 4}
                      className="flex items-center gap-1 px-4 py-2.5 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-semibold hover:bg-[var(--ss-o-600)] disabled:opacity-40 transition-all"
                    >
                      <Tag size={14} />
                      Add
                    </button>
                  </div>
                  {nextMonthTopics.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {nextMonthTopics.map((topic) => (
                        <span
                          key={topic}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--ss-o-50)] text-[var(--ss-o-700)] border border-[var(--ss-o-200)] text-xs font-semibold"
                        >
                          {topic}
                          <button
                            type="button"
                            onClick={() => removeTopic(topic)}
                            className="hover:text-[var(--ss-o-900)] transition-colors"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-[var(--ss-i-400)] mt-2">{nextMonthTopics.length}/4 topics added</p>
                </div>
              )}
              {q.type === "free_form" && (
                <textarea
                  value={freeForm}
                  onChange={(e) => setFreeForm(e.target.value)}
                  rows={3}
                  placeholder="Optional — leave blank if everything else looks accurate."
                  className="w-full px-4 py-3 rounded-[10px] border border-[var(--ss-i-300)] bg-white text-[var(--ss-i-900)] placeholder-[var(--ss-i-400)] focus:border-[var(--ss-o-500)] focus:ring-2 focus:ring-[var(--ss-o-200)] outline-none transition text-sm resize-none"
                />
              )}
            </QuestionCard>
          ))}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[var(--ss-o-500)] text-white font-semibold hover:bg-[var(--ss-o-600)] hover:shadow-[var(--ss-shadow-brand)] active:bg-[var(--ss-o-700)] disabled:opacity-60 transition-all mt-2"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Getting things ready…
              </>
            ) : (
              "Regenerate Report"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

function QuestionCard({
  index,
  total,
  question,
  children,
}: {
  index: number;
  total: number;
  question: QuestionnaireQuestion;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-[var(--ss-shadow)] border border-[var(--ss-i-200)] p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-[var(--ss-i-400)] uppercase tracking-wide">
          Question {index + 1} of {total}
        </p>
      </div>
      <h3 className="text-sm font-semibold text-[var(--ss-i-900)] mb-1">{question.label}</h3>
      {question.description && (
        <p className="text-xs text-[var(--ss-i-400)] mb-4">{question.description}</p>
      )}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function DropdownField({
  options,
  value,
  onChange,
}: {
  options: { value: number; label: string }[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
            value === opt.value
              ? "border-[var(--ss-o-500)] bg-[var(--ss-o-50)]"
              : "border-[var(--ss-i-200)] hover:border-[var(--ss-o-300)] hover:bg-[var(--ss-o-50)]/50"
          }`}
        >
          <input
            type="radio"
            name={`dropdown-${opt.value}`}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="mt-0.5 accent-[var(--ss-o-500)]"
          />
          <span className="text-sm text-[var(--ss-i-700)]">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
