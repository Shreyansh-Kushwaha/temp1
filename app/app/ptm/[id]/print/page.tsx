import { MOCK_REPORTS, MOCK_ESCALATED, type PTMReport } from "@/app/lib/mock-data";
import PrintButton from "./PrintButton";

const ALL_MOCK_REPORTS = [...MOCK_REPORTS, ...MOCK_ESCALATED];

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

async function fetchReport(id: string): Promise<PTMReport | undefined> {
  // Server component — try the live backend first, fall back to mocks.
  try {
    const base = process.env.PTM_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/ptm/reports/${id}`, { cache: "no-store" });
    if (res.ok) return (await res.json()) as PTMReport;
  } catch {
    // fall through to mocks
  }
  return ALL_MOCK_REPORTS.find((r) => r.id === id);
}

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await fetchReport(id);

  if (!report) {
    return (
      <div style={{ fontFamily: "Inter, system-ui, sans-serif", padding: "2rem", color: "#0F1115" }}>
        <p>Report not found.</p>
      </div>
    );
  }

  const d = report.draft_content;
  const conf = d.ai_confidence;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: white;
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          color: #2A2E36;
        }

        .report-container {
          max-width: 680px;
          margin: 0 auto;
          padding: 48px 40px;
          background: white;
          min-height: 100vh;
        }

        .display { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .report-container { padding: 32px; min-height: auto; }
          @page { margin: 1cm; }
        }
      `}</style>

      {/* Back to preview button — hidden on print */}
      <div className="no-print" style={{
        position: "fixed", top: "16px", left: "16px", zIndex: 50,
      }}>
        <a
          href={`/ptm/${id}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "8px 16px", borderRadius: "9999px",
            background: "#F2F4F7", color: "#2A2E36",
            fontSize: "13px", fontWeight: 600, textDecoration: "none",
            border: "1px solid #E5E8EE",
          }}
        >
          ← Back to Preview
        </a>
        <PrintButton />
      </div>

      <div className="report-container">
        {/* ── Document Header ── */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          paddingBottom: "24px", marginBottom: "28px",
          borderBottom: "1.5px solid #E5E8EE",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                background: "#FF6B1F", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ color: "white", fontWeight: 800, fontSize: "12px", fontFamily: "'Plus Jakarta Sans', system-ui" }}>S</span>
              </div>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#8A91A1", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Super Sheldon · PTM Report
                </p>
              </div>
            </div>
            <h1 className="display" style={{
              fontSize: "26px", fontWeight: 800, color: "#0F1115",
              letterSpacing: "-0.02em", marginBottom: "6px",
            }}>
              {d.header.student_name}
            </h1>
            <p style={{ fontSize: "13px", color: "#5B6271" }}>
              {d.header.subject} &nbsp;·&nbsp; {d.header.teacher_name}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "10px", color: "#8A91A1", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
              Reporting Period
            </p>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#2A2E36" }}>
              {d.header.reporting_month ?? d.header.reporting_period}
            </p>
          </div>
        </div>

        {/* ── Sessions & Attendance ── */}
        <PrintSection title="Sessions & Attendance">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <PrintStat label="Total Classes" value={d.sessions_attendance.total_classes} />
            <PrintStat label="Attendance Rate" value={`${d.sessions_attendance.attendance_pct}%`} accent />
            <PrintStat label="No-shows" value={d.sessions_attendance.no_shows} />
          </div>
          <div style={{ width: "100%", height: "4px", borderRadius: "9999px", background: "#E5E8EE", overflow: "hidden" }}>
            <div style={{
              width: `${d.sessions_attendance.attendance_pct}%`,
              height: "4px", borderRadius: "9999px", background: "#FF6B1F",
            }} />
          </div>
        </PrintSection>

        {/* ── Learning Coverage ── */}
        <PrintSection title="Learning Coverage">
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
            {d.learning_coverage.topics.map((topic, idx) => {
              const t = asString(topic);
              return (
                <li key={`${t}-${idx}`} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", color: "#2A2E36" }}>
                  <span style={{ marginTop: "6px", width: "5px", height: "5px", borderRadius: "50%", background: "#FF6B1F", flexShrink: 0 }} />
                  {t}
                </li>
              );
            })}
          </ul>
        </PrintSection>

        {/* ── Student Performance ── */}
        <PrintSection title="Student Performance">
          <p style={{ fontSize: "13px", lineHeight: "1.7", color: "#2A2E36" }}>
            {d.student_performance.narrative}
          </p>
        </PrintSection>

        {/* ── At-Home Action Plan ── */}
        {d.at_home_action_plan && d.at_home_action_plan.items.length > 0 && (
          <PrintSection title="At-Home Action Plan">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {d.at_home_action_plan.items.map((item, i) => (
                <div key={i} style={{
                  padding: "12px", borderRadius: "8px",
                  background: "#FFFAF5",
                  border: "1px solid #FFE0C7",
                }}>
                  <p className="display" style={{
                    fontSize: "12px", fontWeight: 700, color: "#0F1115",
                    marginBottom: "4px",
                  }}>
                    {item.title}
                  </p>
                  <p style={{ fontSize: "11px", color: "#5B6271", lineHeight: "1.55" }}>
                    {item.description}
                  </p>
                  <p style={{
                    fontSize: "9px", fontWeight: 700, color: "#C24808",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    marginTop: "6px",
                  }}>
                    {item.category}
                  </p>
                </div>
              ))}
            </div>
          </PrintSection>
        )}

        {/* ── Next Steps ── */}
        <PrintSection title="Next Steps">
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
            {d.next_steps.topics.slice(0, 4).map((topic, idx) => {
              const t = asString(topic);
              return (
                <li key={`${t}-${idx}`} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", color: "#2A2E36" }}>
                  <span style={{ fontWeight: 700, color: "#FF6B1F", flexShrink: 0 }}>→</span>
                  {t}
                </li>
              );
            })}
          </ul>
        </PrintSection>

        {/* ── Teacher's Note ── */}
        {(report.teacher_note ?? d.teacher_note) && (
          <PrintSection title="Teacher's Note">
            <p style={{ fontSize: "13px", fontStyle: "italic", color: "#5B6271", lineHeight: "1.6" }}>
              &ldquo;{report.teacher_note ?? d.teacher_note}&rdquo;
            </p>
          </PrintSection>
        )}

        {/* ── Footer ── */}
        <div style={{
          marginTop: "40px", paddingTop: "20px",
          borderTop: "1px solid #E5E8EE",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <p style={{ fontSize: "10px", color: "#8A91A1" }}>
            Generated by Super Sheldon PTM Agent · Sheldon Labs
            {conf && conf.overall != null && ` · AI confidence ${conf.overall}/100`}
          </p>
          <p style={{ fontSize: "10px", color: "#8A91A1" }}>
            {d.header.reporting_month ?? d.header.reporting_period}
          </p>
        </div>
      </div>
    </>
  );
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <h2 style={{
        fontSize: "10px", fontWeight: 700, color: "#8A91A1",
        textTransform: "uppercase", letterSpacing: "0.1em",
        marginBottom: "12px",
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function PrintStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div style={{
      padding: "12px", borderRadius: "8px",
      background: accent ? "#FFF1E6" : "#F2F4F7",
      border: `1px solid ${accent ? "#FFE0C7" : "#E5E8EE"}`,
    }}>
      <p style={{
        fontSize: "20px", fontWeight: 800,
        color: accent ? "#C24808" : "#0F1115",
        fontFamily: "'Plus Jakarta Sans', system-ui",
        letterSpacing: "-0.02em",
        marginBottom: "3px",
      }}>
        {value}
      </p>
      <p style={{ fontSize: "10px", color: "#8A91A1" }}>{label}</p>
    </div>
  );
}
