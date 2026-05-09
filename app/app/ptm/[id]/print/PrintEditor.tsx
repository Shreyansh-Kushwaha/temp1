"use client";

import { useState } from "react";
import { api } from "@/app/lib/api";
import type { PTMReport } from "@/app/lib/mock-data";
import { isPdfSectionShown } from "@/app/lib/pdf-sections";

type Mode = "view" | "edit";

function asString(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    const name = (o.name ?? o.title ?? o.topic) as string | undefined;
    const desc = (o.description ?? o.detail) as string | undefined;
    if (name && desc) return `${name} — ${desc}`;
    return name ?? desc ?? JSON.stringify(item);
  }
  return String(item ?? "");
}

interface Props {
  id: string;
  initialReport: PTMReport;
}

type Draft = PTMReport["draft_content"];

export default function PrintEditor({ id, initialReport }: Props) {
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState<Draft>(initialReport.draft_content);
  const [teacherNote, setTeacherNote] = useState<string>(
    initialReport.teacher_note ?? initialReport.draft_content.teacher_note ?? ""
  );
  const [savedDraft, setSavedDraft] = useState<Draft>(initialReport.draft_content);
  const [savedNote, setSavedNote] = useState<string>(teacherNote);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function downloadPdf() {
    setDownloading(true);
    setDownloadError(null);
    try {
      // If there are unsaved edits, save them first so the rendered PDF
      // matches what the teacher sees.
      if (dirty) {
        const next = { ...draft, teacher_note: teacherNote };
        await api.reports.patch(id, next);
        setSavedDraft(draft);
        setSavedNote(teacherNote);
      }
      const { pdf_url } = await api.reports.renderPdf(id);
      // Cache-bust: the same URL is reused on every render (path is keyed by
      // version_number), so without a query-string buster the browser will
      // happily serve any prior cached blank/stale version.
      const fresh = `${pdf_url}${pdf_url.includes("?") ? "&" : "?"}t=${Date.now()}`;
      const res = await fetch(fresh, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const studentSlug = (draft.header.student_name || "report")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const monthSlug = (draft.header.reporting_month || "").replace(/[^a-z0-9-]+/gi, "-");
      a.download = `${studentSlug}${monthSlug ? "-" + monthSlug : ""}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(savedDraft) ||
    teacherNote !== savedNote;

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function patchHeader(key: keyof Draft["header"], value: string) {
    setDraft((prev) => ({
      ...prev,
      header: { ...prev.header, [key]: value },
    }));
  }

  function patchSessions(key: keyof Draft["sessions_attendance"], value: number) {
    setDraft((prev) => ({
      ...prev,
      sessions_attendance: { ...prev.sessions_attendance, [key]: value },
    }));
  }

  function patchTopics(section: "learning_coverage" | "next_steps", topics: string[]) {
    setDraft((prev) => ({
      ...prev,
      [section]: { ...prev[section], topics },
    }));
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const next = { ...draft, teacher_note: teacherNote };
      await api.reports.patch(id, next);
      setSavedDraft(draft);
      setSavedNote(teacherNote);
      setMode("view");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft(savedDraft);
    setTeacherNote(savedNote);
    setSaveError(null);
  }

  const editing = mode === "edit";
  const learningTopics = draft.learning_coverage.topics.map(asString);
  const nextStepTopics = draft.next_steps.topics.map(asString);
  const hidden = draft._pdf_hidden_sections;
  const show = (key: string) => isPdfSectionShown(hidden, key);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }

        body {
          background: #F5F6F8;
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          color: #2A2E36;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .page-wrap {
          max-width: 21cm;
          margin: 24px auto;
          background: white;
          box-shadow: 0 2px 16px rgba(15, 17, 21, 0.08);
        }

        .report-container {
          max-width: 680px;
          margin: 0 auto;
          padding: 32px 40px;
          background: white;
        }

        .banner-img { display: block; width: 100%; height: auto; }

        .display { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

        /* Editable field affordances */
        .editable {
          border-radius: 4px;
          transition: background 120ms, box-shadow 120ms;
        }
        .editing-mode .editable {
          background: rgba(255, 107, 31, 0.06);
          box-shadow: inset 0 0 0 1px rgba(255, 107, 31, 0.30);
          padding: 2px 6px;
          margin: -2px -6px;
          cursor: text;
          outline: none;
        }
        .editing-mode .editable:hover {
          background: rgba(255, 107, 31, 0.12);
          box-shadow: inset 0 0 0 1px rgba(255, 107, 31, 0.55);
        }
        .editing-mode .editable:focus {
          background: white;
          box-shadow: inset 0 0 0 2px #FF6B1F;
        }

        .num-input {
          font: inherit;
          color: inherit;
          background: transparent;
          border: 0;
          width: 100%;
          text-align: center;
          outline: none;
        }
        .editing-mode .num-input {
          background: white;
          box-shadow: inset 0 0 0 2px #FF6B1F;
          border-radius: 4px;
          padding: 2px 4px;
        }

        .topic-row { display: flex; align-items: flex-start; gap: 10px; }
        .row-delete {
          display: none;
          flex-shrink: 0;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 0;
          background: #E7556B;
          color: white;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          line-height: 1;
        }
        .editing-mode .row-delete { display: inline-flex; align-items: center; justify-content: center; }

        .add-row {
          display: none;
          margin-top: 6px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          color: #1E2A5E;
          background: #FFF1E6;
          border: 1px dashed #FF6B1F;
          border-radius: 9999px;
          cursor: pointer;
        }
        .editing-mode .add-row { display: inline-block; }

        /* Pagination control: keep each section together; let the browser
           flow content across 1, 2, or 3 pages naturally based on length. */
        .pdf-section,
        .pdf-callout {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .pdf-section h2 {
          break-after: avoid;
          page-break-after: avoid;
        }
        .pdf-section li,
        .pdf-section p {
          orphans: 2;
          widows: 2;
        }

        /* Table layout: <thead> repeats the brand HEADER on every printed
           page automatically (via display: table-header-group). The FOOTER
           strategy is split — <tfoot> shows it at end of doc on screen,
           but in print we hide tfoot and use a position: fixed copy of the
           footer image so it sits flush to the BOTTOM of every page, including
           the last (which tfoot can't do for partial-page content). */
        .page-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .page-table > thead { display: table-header-group; }
        .page-table > tfoot { display: table-footer-group; }
        .page-table td { padding: 0; vertical-align: top; }

        @media print {
          body { background: white !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .page-wrap {
            max-width: none;
            box-shadow: none;
            margin: 0;
          }
          .report-container { padding: 24px 32px; }

          /* Force explicit banner heights so the browser allocates exactly
             these dimensions on every printed page. Combined with the tbody
             height below, each page becomes thead (5cm) + tbody (21.9cm)
             + tfoot (2.8cm) = 29.7cm = A4 height. */
          .banner-header {
            display: block;
            width: 100%;
            height: 5cm;
            object-fit: cover;
            object-position: top center;
          }
          .banner-footer {
            display: block;
            width: 100%;
            height: 2.8cm;
            object-fit: cover;
            object-position: bottom center;
          }

          /* Tbody cell takes the remaining height per page. On the last
             page when content is short, vertical-align: middle centers it
             so empty space distributes evenly above and below — instead of
             content stuck to the top with all the empty space below. */
          .page-table tbody td {
            height: calc(100vh - 5cm - 2.8cm);
            vertical-align: middle;
          }

          .editable, .editable:hover, .editable:focus {
            background: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .num-input {
            background: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .row-delete, .add-row { display: none !important; }

          /* @page margin 0 gives banners edge-to-edge of paper. For Chrome:
             set Margins → "None" in the print dialog so the browser doesn't
             add its own margin around ours. */
          @page { size: A4; margin: 0; }
        }
      `}</style>

      {/* Floating toolbar — hidden on print */}
      <div className="no-print" style={{
        position: "fixed", top: 16, right: 16, zIndex: 50,
        display: "flex", alignItems: "center", gap: 8,
        background: "white",
        padding: "8px 12px",
        borderRadius: 9999,
        boxShadow: "0 4px 16px rgba(15, 17, 21, 0.12)",
        border: "1px solid #E5E8EE",
      }}>
        <a
          href={`/ptm/${id}`}
          style={{
            padding: "6px 12px", borderRadius: 9999,
            background: "#F2F4F7", color: "#2A2E36",
            fontSize: 12, fontWeight: 600, textDecoration: "none",
            border: "1px solid #E5E8EE",
          }}
        >
          ← Back
        </a>

        {!editing && (
          <button
            onClick={() => setMode("edit")}
            style={pillButton("#1E2A5E", "white")}
          >
            ✎ Edit
          </button>
        )}

        {editing && (
          <>
            <button
              onClick={reset}
              disabled={!dirty || saving}
              style={pillButton("#F2F4F7", "#2A2E36", !dirty || saving)}
            >
              Reset
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              style={pillButton("#FF6B1F", "white", !dirty || saving)}
            >
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
            <button
              onClick={() => { reset(); setMode("view"); }}
              style={pillButton("#F2F4F7", "#2A2E36")}
            >
              Done
            </button>
          </>
        )}

        <button
          onClick={downloadPdf}
          disabled={downloading}
          style={pillButton("#FF6B1F", "white", downloading)}
        >
          {downloading ? (
            <>
              <span style={{
                display: "inline-block",
                width: 10, height: 10, marginRight: 6,
                border: "2px solid rgba(255,255,255,0.4)",
                borderTopColor: "white",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                verticalAlign: "middle",
              }} />
              Rendering…
            </>
          ) : (
            <>↓ Download PDF</>
          )}
        </button>
      </div>

      {/* Toasts */}
      {(saveError || downloadError) && (
        <div className="no-print" style={{
          position: "fixed", top: 72, right: 16, zIndex: 50,
          background: "#FFEBEE", color: "#C62828",
          border: "1px solid #FFCDD2",
          padding: "8px 14px", borderRadius: 8,
          fontSize: 12, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(15, 17, 21, 0.12)",
          maxWidth: 280,
        }}>
          {saveError || downloadError}
        </div>
      )}

      <div className={`page-wrap ${editing ? "editing-mode" : ""}`}>
       <table className="page-table">
        <thead>
          <tr><td>
            <img src="/header.jpg" alt="Super Sheldon" className="banner-img banner-header" />
          </td></tr>
        </thead>
        <tbody>
          <tr><td>
        <div className="report-container">
          {/* Title with multicolor underline */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h1 className="display" style={{
              fontSize: 30, fontWeight: 800, color: "#1E2A5E",
              letterSpacing: "-0.01em", marginBottom: 10,
            }}>
              Monthly Progress Report
            </h1>
            <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
              {["#FF6B1F", "#FFC93C", "#3FB984", "#22D3EE", "#7C3AED"].map((c, i) => (
                <span key={i} style={{ width: 36, height: 4, background: c, borderRadius: 2 }} />
              ))}
            </div>
          </div>

          {/* Student info bar */}
          <div style={{
            background: "#FFF1E6", borderLeft: "4px solid #FF6B1F",
            padding: "14px 18px", marginBottom: 24,
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "8px 24px", fontSize: 13,
          }}>
            <div>
              <span style={{ fontWeight: 700, color: "#1E2A5E" }}>Student:</span>{" "}
              <Editable
                editing={editing}
                value={draft.header.student_name}
                onChange={(v) => patchHeader("student_name", v)}
              />
            </div>
            <div>
              <span style={{ fontWeight: 700, color: "#1E2A5E" }}>Subject:</span>{" "}
              <Editable
                editing={editing}
                value={draft.header.subject}
                onChange={(v) => patchHeader("subject", v)}
              />
            </div>
            <div>
              <span style={{ fontWeight: 700, color: "#1E2A5E" }}>Teacher:</span>{" "}
              <Editable
                editing={editing}
                value={draft.header.teacher_name}
                onChange={(v) => patchHeader("teacher_name", v)}
              />
            </div>
            <div>
              <span style={{ fontWeight: 700, color: "#1E2A5E" }}>Reporting Month:</span>{" "}
              <Editable
                editing={editing}
                value={draft.header.reporting_month ?? draft.header.reporting_period ?? ""}
                onChange={(v) => patchHeader("reporting_month", v)}
              />
            </div>
          </div>

          {/* Sessions & Attendance */}
          {show("sessions_attendance") && (
            <PrintSection title="Sessions & Attendance">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <PrintStat
                  label="Classes Conducted" theme="orange" editing={editing}
                  value={draft.sessions_attendance.total_classes}
                  onChange={(n) => patchSessions("total_classes", n)}
                />
                <PrintStat
                  label="Attendance" theme="mint" editing={editing} suffix="%"
                  value={draft.sessions_attendance.attendance_pct}
                  onChange={(n) => patchSessions("attendance_pct", n)}
                />
                <PrintStat
                  label="No-shows" theme="pink" editing={editing}
                  value={draft.sessions_attendance.no_shows}
                  onChange={(n) => patchSessions("no_shows", n)}
                />
              </div>
            </PrintSection>
          )}

          {/* Learning Coverage */}
          {show("learning_coverage") && (
            <PrintSection title="Learning Coverage">
              <TopicsList
                editing={editing}
                topics={learningTopics}
                onChange={(t) => patchTopics("learning_coverage", t)}
              />
            </PrintSection>
          )}

          {/* Student Performance */}
          {show("student_performance") && (
            <PrintSection title="Overall Performance">
              <Editable
                editing={editing}
                multiline
                value={draft.student_performance.narrative}
                onChange={(v) => patch("student_performance", { ...draft.student_performance, narrative: v })}
                style={{ fontSize: 13, lineHeight: "1.7", color: "#2A2E36", display: "block" }}
              />
            </PrintSection>
          )}

          {/* At-Home Action Plan */}
          {show("at_home_action_plan") && draft.at_home_action_plan && draft.at_home_action_plan.items.length > 0 && (
            <PrintSection title="At-Home Action Plan">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {draft.at_home_action_plan.items.map((item, i) => (
                  <div key={i} className="pdf-callout" style={{
                    padding: 12, borderRadius: 8,
                    background: "#FFFAF5", border: "1px solid #FFE0C7",
                  }}>
                    <p className="display" style={{ fontSize: 12, fontWeight: 700, color: "#0F1115", marginBottom: 4 }}>
                      {item.title}
                    </p>
                    <p style={{ fontSize: 11, color: "#5B6271", lineHeight: 1.55 }}>
                      {item.description}
                    </p>
                    <p style={{
                      fontSize: 9, fontWeight: 700, color: "#C24808",
                      textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6,
                    }}>
                      {item.category}
                    </p>
                  </div>
                ))}
              </div>
            </PrintSection>
          )}

          {/* Next Steps */}
          {show("next_steps") && (
            <PrintSection title="Next Steps">
              <TopicsList
                editing={editing}
                topics={nextStepTopics}
                onChange={(t) => patchTopics("next_steps", t)}
                bullet="→"
                limit={4}
              />
            </PrintSection>
          )}

          {/* Key Strengths */}
          {show("strengths") && draft.strengths && draft.strengths.items.length > 0 && (
            <PrintSection title="Key Strengths">
              <ul style={{ listStyle: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {draft.strengths.items.map((item, i) => (
                  <li key={i} className="pdf-callout" style={{
                    background: "#F1F8E9",
                    border: "1px solid #C8E6C9",
                    borderRadius: 6,
                    padding: "10px 12px",
                    fontSize: 12,
                    color: "#1E2A5E",
                    display: "flex", gap: 8, alignItems: "flex-start",
                  }}>
                    <span style={{ color: "#3FB984", fontSize: 14, lineHeight: 1.2 }}>★</span>
                    {asString(item)}
                  </li>
                ))}
              </ul>
            </PrintSection>
          )}

          {/* Areas to Grow */}
          {show("growth_areas") && draft.growth_areas && draft.growth_areas.items.length > 0 && (
            <PrintSection title="Areas to Grow">
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {draft.growth_areas.items.map((item, i) => (
                  <li key={i} style={{
                    fontSize: 13, color: "#2A2E36",
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                    <span style={{
                      color: "white", background: "#E7556B",
                      width: 18, height: 18, borderRadius: "50%",
                      fontSize: 10, fontWeight: 700,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>{i + 1}</span>
                    {asString(item)}
                  </li>
                ))}
              </ul>
            </PrintSection>
          )}

          {/* Homework & Effort */}
          {show("homework_and_effort") && draft.homework_and_effort?.narrative && (
            <PrintSection title="Homework & Effort">
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "#2A2E36" }}>
                {draft.homework_and_effort.narrative}
              </p>
            </PrintSection>
          )}

          {/* Milestone of the Month */}
          {show("milestone_of_month") && draft.milestone_of_month?.title && (
            <PrintSection title="Milestone of the Month">
              <div className="pdf-callout" style={{
                background: "#FFF7E6",
                border: "1px solid #FFE0A8",
                borderLeft: "4px solid #FFC93C",
                borderRadius: 4,
                padding: "14px 18px",
              }}>
                <p className="display" style={{ fontSize: 14, fontWeight: 800, color: "#1E2A5E", marginBottom: 6 }}>
                  🏆 {draft.milestone_of_month.title}
                </p>
                <p style={{ fontSize: 12, color: "#2A2E36", lineHeight: 1.6 }}>
                  {draft.milestone_of_month.description}
                </p>
              </div>
            </PrintSection>
          )}

          {/* Recommended Resources */}
          {show("recommended_resources") && draft.recommended_resources && draft.recommended_resources.items.length > 0 && (
            <PrintSection title="Recommended Resources">
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {draft.recommended_resources.items.map((item, i) => (
                  <li key={i} style={{
                    fontSize: 13, color: "#2A2E36",
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                    <span style={{ color: "#22D3EE", fontSize: 14, lineHeight: 1.4 }}>📚</span>
                    {asString(item)}
                  </li>
                ))}
              </ul>
            </PrintSection>
          )}

          {/* Encouragement Message */}
          {show("encouragement_message") && draft.encouragement_message && (
            <div className="pdf-callout" style={{
              background: "#FFF1E6",
              borderLeft: "4px solid #FF6B1F",
              padding: "16px 20px",
              marginBottom: 22,
              fontSize: 13, fontStyle: "italic", color: "#1E2A5E", lineHeight: 1.6,
            }}>
              {draft.encouragement_message}
            </div>
          )}

          {/* Teacher's Note */}
          {show("teacher_note") && (editing || teacherNote) && (
            <div className="pdf-callout" style={{
              background: "#E8F5E9", borderLeft: "4px solid #3FB984",
              padding: "16px 20px", marginTop: 24, marginBottom: 24,
            }}>
              <Editable
                editing={editing}
                multiline
                value={teacherNote}
                placeholder="Add the teacher's closing note for parents…"
                onChange={(v) => setTeacherNote(v)}
                style={{ fontSize: 13, fontStyle: "italic", color: "#1E2A5E", lineHeight: 1.6, display: "block", marginBottom: 8 }}
              />
              <p style={{ fontSize: 12, fontWeight: 700, color: "#3FB984" }}>
                — {draft.header.teacher_name}
              </p>
            </div>
          )}

        </div>
          </td></tr>
        </tbody>
        <tfoot>
          <tr><td>
            <img src="/footer.jpg" alt="" className="banner-img banner-footer" />
          </td></tr>
        </tfoot>
       </table>
      </div>
    </>
  );
}

// ── Helpers & sub-components ────────────────────────────────────────────────

function pillButton(bg: string, color: string, disabled = false): React.CSSProperties {
  return {
    padding: "6px 14px", borderRadius: 9999,
    background: bg, color,
    fontSize: 12, fontWeight: 700,
    border: 0,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function Editable({
  editing,
  value,
  onChange,
  multiline = false,
  placeholder,
  style,
}: {
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  if (!editing) {
    return <span style={style}>{value || placeholder || ""}</span>;
  }
  // Use uncontrolled contentEditable so caret position is preserved while typing.
  // Commit value on blur. `key` resets the DOM value when underlying value changes (e.g. Reset).
  return (
    <span
      key={value}
      className="editable"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      style={{
        display: multiline ? "block" : "inline",
        whiteSpace: multiline ? "pre-wrap" : "normal",
        ...style,
      }}
      onBlur={(e) => {
        const next = (multiline ? e.currentTarget.innerText : e.currentTarget.textContent) ?? "";
        if (next !== value) onChange(next);
      }}
      data-placeholder={placeholder}
    >
      {value}
    </span>
  );
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pdf-section" style={{ marginBottom: 22 }}>
      <h2 style={{
        fontSize: 11, fontWeight: 700, color: "#1E2A5E",
        textTransform: "uppercase", letterSpacing: "0.1em",
        paddingBottom: 8, marginBottom: 12,
        borderBottom: "1px solid #E5E8EE",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1E2A5E", display: "inline-block" }} />
        {title}
      </h2>
      {children}
    </div>
  );
}

const STAT_THEMES = {
  orange: { bg: "#FFF1E6", border: "#FFE0C7", text: "#FF6B1F" },
  mint:   { bg: "#E8F5E9", border: "#B7E0BB", text: "#3FB984" },
  pink:   { bg: "#FFE4E6", border: "#FFCDD2", text: "#E7556B" },
} as const;

function PrintStat({
  label, value, theme = "orange", editing, onChange, suffix = "",
}: {
  label: string;
  value: number;
  theme?: keyof typeof STAT_THEMES;
  editing: boolean;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  const t = STAT_THEMES[theme];
  return (
    <div style={{
      padding: "16px 12px", borderRadius: 6,
      background: t.bg, border: `1px solid ${t.border}`,
      textAlign: "center",
    }}>
      <p style={{
        fontSize: 26, fontWeight: 800, color: t.text,
        fontFamily: "'Plus Jakarta Sans', system-ui",
        letterSpacing: "-0.02em", marginBottom: 4, lineHeight: 1.0,
        display: "flex", justifyContent: "center", alignItems: "baseline", gap: 1,
      }}>
        {editing ? (
          <input
            type="number"
            className="num-input"
            value={Number.isFinite(value) ? value : 0}
            onChange={(e) => {
              const n = Number(e.currentTarget.value);
              onChange(Number.isFinite(n) ? n : 0);
            }}
            style={{ fontSize: 26, fontWeight: 800, color: t.text, fontFamily: "'Plus Jakarta Sans', system-ui" }}
          />
        ) : (
          <span>{value}</span>
        )}
        {suffix && <span>{suffix}</span>}
      </p>
      <p style={{
        fontSize: 10, fontWeight: 700, color: "#1E2A5E",
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        {label}
      </p>
    </div>
  );
}

function TopicsList({
  topics, editing, onChange, bullet = "★", limit,
}: {
  topics: string[];
  editing: boolean;
  onChange: (next: string[]) => void;
  bullet?: string;
  limit?: number;
}) {
  const items = limit ? topics.slice(0, limit) : topics;
  return (
    <>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((topic, idx) => (
          <li key={idx} className="topic-row" style={{ fontSize: 13, color: "#2A2E36" }}>
            <span style={{
              color: "#FF6B1F", flexShrink: 0,
              fontSize: bullet === "→" ? 14 : 14,
              fontWeight: bullet === "→" ? 700 : 400,
              lineHeight: "1.4",
            }}>{bullet}</span>
            <Editable
              editing={editing}
              value={topic}
              onChange={(v) => {
                const next = [...topics];
                next[idx] = v;
                onChange(next);
              }}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="row-delete no-print"
              aria-label="Remove topic"
              onClick={() => onChange(topics.filter((_, i) => i !== idx))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="add-row no-print"
        onClick={() => onChange([...topics, ""])}
      >
        + Add topic
      </button>
    </>
  );
}
