"use client";

import { useState } from "react";
import { Eye, EyeOff, FileText } from "lucide-react";
import { api } from "@/app/lib/api";
import { PDF_SECTIONS } from "@/app/lib/pdf-sections";
import type { ReportDraft } from "@/app/lib/mock-data";

interface Props {
  reportId: string;
  draft: ReportDraft;
  /** Called after a successful save with the updated hidden-sections array. */
  onSaved: (hiddenSections: string[]) => void;
}

/**
 * Sidebar panel that lets the teacher pick which sections appear in the
 * generated PDF. Saves immediately on each toggle via api.reports.patch so
 * the print page (and future PDF rendering) reflect the choice.
 */
export default function PdfSectionsPanel({ reportId, draft, onSaved }: Props) {
  const initialHidden = draft._pdf_hidden_sections ?? [];
  const [hidden, setHidden] = useState<string[]>(initialHidden);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sections = PDF_SECTIONS.filter((s) => !s.available || s.available(draft));

  async function toggle(key: string) {
    const next = hidden.includes(key)
      ? hidden.filter((k) => k !== key)
      : [...hidden, key];
    setHidden(next);
    setSavingKey(key);
    setError(null);
    try {
      await api.reports.patch(reportId, { ...draft, _pdf_hidden_sections: next });
      onSaved(next);
    } catch (e) {
      // Revert on failure
      setHidden(hidden);
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingKey(null);
    }
  }

  const visibleCount = sections.filter((s) => !hidden.includes(s.key)).length;

  return (
    <div className="bg-white rounded-2xl border border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-[var(--ss-i-400)]" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ss-i-500)]">
            PDF Contents
          </p>
        </div>
        <span className="text-[10px] font-semibold text-[var(--ss-i-400)]">
          {visibleCount}/{sections.length}
        </span>
      </div>

      <p className="text-[11px] text-[var(--ss-i-400)] mb-3 leading-relaxed">
        Click a section to include or hide it from the PDF sent to parents.
      </p>

      <ul className="space-y-1.5">
        {sections.map((s) => {
          const isHidden = hidden.includes(s.key);
          const isSaving = savingKey === s.key;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => toggle(s.key)}
                disabled={isSaving}
                className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-colors disabled:opacity-60 ${
                  isHidden
                    ? "bg-[var(--ss-i-100)] hover:bg-[var(--ss-i-200)]"
                    : "bg-[var(--ss-o-50)] hover:bg-[var(--ss-o-100)] border border-[var(--ss-o-200)]"
                }`}
                aria-pressed={!isHidden}
              >
                <span
                  className={`mt-0.5 shrink-0 ${
                    isHidden ? "text-[var(--ss-i-400)]" : "text-[var(--ss-o-600)]"
                  }`}
                >
                  {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-xs font-semibold ${
                    isHidden ? "text-[var(--ss-i-500)] line-through" : "text-[var(--ss-i-800)]"
                  }`}>
                    {s.label}
                  </span>
                  <span className={`block text-[10px] mt-0.5 leading-snug ${
                    isHidden ? "text-[var(--ss-i-400)]" : "text-[var(--ss-i-500)]"
                  }`}>
                    Page {s.page} · {s.description}
                  </span>
                </span>
                {isSaving && (
                  <span className="mt-0.5 w-3 h-3 rounded-full border-2 border-[var(--ss-o-200)] border-t-[var(--ss-o-600)] animate-spin shrink-0" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-3 text-[10px] text-[var(--ss-error)] font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}
