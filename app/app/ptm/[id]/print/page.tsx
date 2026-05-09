import { MOCK_REPORTS, MOCK_ESCALATED, type PTMReport } from "@/app/lib/mock-data";
import PrintEditor from "./PrintEditor";

const ALL_MOCK_REPORTS = [...MOCK_REPORTS, ...MOCK_ESCALATED];

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

  return <PrintEditor id={id} initialReport={report} />;
}
