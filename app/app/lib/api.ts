import type {
  PTMReport,
  QuestionnaireQuestion,
  ToneSettings,
  ReportDraft,
  AudioSummary,
  ReportVersionMeta,
  ReportVersion,
  StudentRiskGroup,
  RiskSignal,
  CopilotMessage,
  KnowledgeSummary,
  StudentConcept,
} from "@/app/lib/mock-data";

const BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface QuestionnaireSubmission {
  engagement_rating?: number;
  concept_rating?: number;
  application_rating?: number;
  topics_correction?: string;
  next_month_topics?: string[];
  free_form_note?: string;
  tone?: Partial<ToneSettings>;
}

export interface StudentSummary {
  student_id: string;
  student_name: string;
  subject: string;
  session_count: number;
  last_session?: string | null;
}

export interface SessionInfo {
  session_id: string;
  date: string;
  topic_summary: string;
  transcript_excerpt?: string;
}

export type DeliveryStatus = "sent" | "failed" | "skipped" | "pending" | string;

export interface DeliveryLogEntry {
  id: string;
  report_id: string;
  channel: string;
  status: DeliveryStatus;
  sent_at: string | null;
  error_msg: string | null;
  recipient: string | null;
  intended_recipient: string | null;
  student_name: string | null;
  subject: string | null;
  reporting_month: string | null;
}

export interface DeliveryLogResponse {
  total: number;
  entries: DeliveryLogEntry[];
}

export type IssueStatus = "open" | "in_progress" | "resolved" | "wont_fix";
export type IssueSeverity = "low" | "medium" | "high";

export interface Issue {
  id: string;
  type: string;
  status: IssueStatus;
  severity: IssueSeverity;
  title: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
}

export interface IssuesResponse {
  total: number;
  entries: Issue[];
  counts_by_type: Record<string, Record<IssueStatus, number>>;
}

export interface EmailRecordsCheckSummary {
  checked: number;
  missing: number;
  opened: number;
  already_open: number;
}

export interface GenerateFromSessionsBody {
  student_id: string;
  student_name: string;
  teacher_name: string;
  subject: string;
  session_ids: string[];
  engagement_level?: string;
  concept_understanding?: string;
  homework_effort?: string;
  specific_highlights?: string;
  improvement_areas?: string;
  parent_note?: string;
  next_month_goals?: string[];
  tone?: Partial<ToneSettings>;
}

export class ApiError extends Error {
  status: number;
  detail: string;
  /** Raw parsed response body. Use this when an endpoint returns structured
   *  errors (e.g. FastAPI HTTPException with detail={"code":..., ...}). */
  data: unknown;
  constructor(status: number, detail: string, data: unknown = null) {
    super(detail || `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.data = data;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    // FastAPI sends `{"detail": "..."}` for HTTPException. `detail` may be
    // a plain string OR an object (we sometimes use {message, code, ...} so
    // callers can branch on machine-readable fields).
    let detail = text;
    let data: unknown = null;
    try {
      data = JSON.parse(text);
      const d = (data as { detail?: unknown })?.detail;
      if (typeof d === "string") {
        detail = d;
      } else if (d && typeof d === "object" && typeof (d as { message?: unknown }).message === "string") {
        detail = (d as { message: string }).message;
      }
    } catch {
      /* leave detail = text */
    }
    throw new ApiError(res.status, detail, data);
  }
  return res.json() as Promise<T>;
}

export const api = {
  teachers: {
    list(): Promise<{ teacher_name: string }[]> {
      return apiFetch("/api/ptm/teachers");
    },

    listAutoGenerate(): Promise<Array<{ teacher_name: string; auto_generate_enabled: boolean }>> {
      return apiFetch(`/api/ptm/teachers/auto-generate`);
    },

    setAutoGenerate(teacher_name: string, enabled: boolean): Promise<{ teacher_name: string; auto_generate_enabled: boolean }> {
      return apiFetch(`/api/ptm/teachers/auto-generate`, {
        method: "PATCH",
        body: JSON.stringify({ teacher_name, enabled }),
      });
    },
  },

  autoGenerate: {
    run(month?: string, batch_size: number = 20): Promise<{
      month: string;
      batch_size: number;
      processed: Array<{ report_id: string; student_id: string; student_name: string; teacher_name?: string }>;
      skipped_existing: string[];
      skipped_no_optin: string[];
      remaining: number;
    }> {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      params.set("batch_size", String(batch_size));
      return apiFetch(`/api/ptm/auto-generate/run?${params.toString()}`, { method: "POST" });
    },
  },

  students: {
    list(params: { teacher_name: string }): Promise<StudentSummary[]> {
      const qs = new URLSearchParams({ teacher_name: params.teacher_name });
      return apiFetch<StudentSummary[]>(`/api/ptm/students?${qs}`);
    },

    sessions(student_id: string): Promise<SessionInfo[]> {
      return apiFetch<SessionInfo[]>(`/api/ptm/students/${student_id}/sessions`);
    },
  },

  reports: {
    list(params?: { status?: string; teacher_id?: string; teacher_name?: string }): Promise<PTMReport[]> {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.teacher_id) qs.set("teacher_id", params.teacher_id);
      if (params?.teacher_name) qs.set("teacher_name", params.teacher_name);
      const query = qs.toString() ? `?${qs}` : "";
      return apiFetch<PTMReport[]>(`/api/ptm/reports${query}`);
    },

    get(id: string): Promise<PTMReport> {
      return apiFetch<PTMReport>(`/api/ptm/reports/${id}`);
    },

    patch(id: string, draft_content: unknown): Promise<{ status: string }> {
      return apiFetch(`/api/ptm/reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ draft_content }),
      });
    },

    renderPdf(id: string): Promise<{ pdf_url: string; version_number: number }> {
      return apiFetch(`/api/ptm/reports/${id}/pdf`, { method: "POST" });
    },

    approve(
      id: string,
      teacher_note?: string,
      recipient_email?: string,
    ): Promise<{ status: string; delivered_via: string[] }> {
      return apiFetch(`/api/ptm/reports/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          teacher_note: teacher_note ?? null,
          recipient_email: recipient_email ?? null,
        }),
      });
    },

    parentEmail(id: string): Promise<{ parent_email: string | null }> {
      return apiFetch(`/api/ptm/reports/${id}/parent-email`);
    },

    reject(id: string): Promise<{ status: string; questions: QuestionnaireQuestion[] }> {
      return apiFetch(`/api/ptm/reports/${id}/reject`, { method: "POST" });
    },

    getQuestionnaire(id: string): Promise<{ questions: QuestionnaireQuestion[] }> {
      return apiFetch(`/api/ptm/reports/${id}/questionnaire`);
    },

    submitQuestionnaire(
      id: string,
      body: QuestionnaireSubmission
    ): Promise<{ status: string; draft_content?: unknown; regeneration_count?: number }> {
      return apiFetch(`/api/ptm/reports/${id}/questionnaire`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    generateFromSessions(
      body: GenerateFromSessionsBody
    ): Promise<{ report_id: string; status: string; draft_content: unknown }> {
      return apiFetch("/api/ptm/reports/from-sessions", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    autoFillForm(body: {
      student_id: string;
      student_name?: string;
      subject?: string;
      session_ids: string[];
    }): Promise<{
      engagement_level: string;
      concept_understanding: string;
      homework_effort: string;
      specific_highlights: string;
      improvement_areas: string;
      next_month_goals: string[];
    }> {
      return apiFetch("/api/ptm/reports/auto-fill-form", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    regenerateWithTone(
      id: string,
      tone: Partial<ToneSettings>
    ): Promise<{ status: string; draft_content: ReportDraft; tone: ToneSettings }> {
      return apiFetch(`/api/ptm/reports/${id}/regenerate-tone`, {
        method: "POST",
        body: JSON.stringify({ tone }),
      });
    },

    listVersions(id: string): Promise<ReportVersionMeta[]> {
      return apiFetch(`/api/ptm/reports/${id}/versions`);
    },

    getVersion(id: string, n: number): Promise<ReportVersion> {
      return apiFetch(`/api/ptm/reports/${id}/versions/${n}`);
    },

    diff(
      id: string,
      params?: { before?: number; after?: number }
    ): Promise<{ before: ReportVersion | null; after: ReportVersion }> {
      const qs = new URLSearchParams();
      if (params?.before != null) qs.set("before", String(params.before));
      if (params?.after != null) qs.set("after", String(params.after));
      const query = qs.toString() ? `?${qs}` : "";
      return apiFetch(`/api/ptm/reports/${id}/diff${query}`);
    },

    audioSummary(id: string): Promise<AudioSummary | null> {
      return apiFetch(`/api/ptm/reports/${id}/audio-summary`);
    },

    createAudioSummary(id: string, voice?: string): Promise<AudioSummary> {
      return apiFetch(`/api/ptm/reports/${id}/audio-summary`, {
        method: "POST",
        body: JSON.stringify({ voice: voice ?? null }),
      });
    },

    delete(id: string): Promise<{ status: string }> {
      return apiFetch(`/api/ptm/reports/${id}`, { method: "DELETE" });
    },
  },

  deliveryLog: {
    list(params?: {
      status?: string;
      channel?: string;
      q?: string;
      since?: string;
      limit?: number;
      offset?: number;
    }): Promise<DeliveryLogResponse> {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.channel) qs.set("channel", params.channel);
      if (params?.q) qs.set("q", params.q);
      if (params?.since) qs.set("since", params.since);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const query = qs.toString() ? `?${qs}` : "";
      return apiFetch<DeliveryLogResponse>(`/api/ptm/delivery-log${query}`);
    },

    resend(logId: string, recipient_email?: string): Promise<{
      id: string;
      channel: string;
      status: string;
      error: string | null;
      recipient?: string | null;
    }> {
      return apiFetch(`/api/ptm/delivery-log/${logId}/resend`, {
        method: "POST",
        body: JSON.stringify({ recipient_email: recipient_email ?? null }),
      });
    },
  },

  issues: {
    list(params?: {
      status?: string;
      type?: string;
      severity?: string;
      q?: string;
      limit?: number;
      offset?: number;
    }): Promise<IssuesResponse> {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.type) qs.set("type", params.type);
      if (params?.severity) qs.set("severity", params.severity);
      if (params?.q) qs.set("q", params.q);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const query = qs.toString() ? `?${qs}` : "";
      return apiFetch<IssuesResponse>(`/api/ptm/issues${query}`);
    },

    update(
      id: string,
      body: { status: IssueStatus; resolution_note?: string; resolved_by?: string },
    ): Promise<{ status: string }> {
      return apiFetch(`/api/ptm/issues/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },

    runEmailRecordsCheck(): Promise<EmailRecordsCheckSummary> {
      return apiFetch(`/api/ptm/issues/checks/email-records/run`, {
        method: "POST",
      });
    },
  },

  risk: {
    recompute(): Promise<{ students_checked: number; active_signals: number }> {
      return apiFetch("/api/ptm/risk/recompute", { method: "POST" });
    },

    studentsAtRisk(severity?: "low" | "medium" | "high"): Promise<StudentRiskGroup[]> {
      const qs = severity ? `?severity=${severity}` : "";
      return apiFetch(`/api/ptm/risk/students-at-risk${qs}`);
    },

    forStudent(studentId: string): Promise<RiskSignal[]> {
      return apiFetch(`/api/ptm/risk/students/${studentId}`);
    },
  },

  copilot: {
    send(body: {
      student_id: string;
      message: string;
      conversation_id?: string;
    }): Promise<{ conversation_id: string; reply: string; suggested_prompts: string[] }> {
      return apiFetch("/api/ptm/copilot/message", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    history(
      student_id: string,
      conversation_id?: string,
      limit = 50
    ): Promise<CopilotMessage[]> {
      const qs = new URLSearchParams({ student_id, limit: String(limit) });
      if (conversation_id) qs.set("conversation_id", conversation_id);
      return apiFetch(`/api/ptm/copilot/history?${qs}`);
    },
  },

  knowledge: {
    summary(student_id: string): Promise<KnowledgeSummary> {
      return apiFetch(`/api/ptm/students/${student_id}/knowledge-summary`);
    },

    generate(
      student_id: string,
      mode: "create" | "update" = "create",
    ): Promise<KnowledgeSummary> {
      return apiFetch(`/api/ptm/students/${student_id}/knowledge-summary/generate`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
    },

    concepts(student_id: string, subject?: string): Promise<StudentConcept[]> {
      const qs = subject ? `?subject=${encodeURIComponent(subject)}` : "";
      return apiFetch(`/api/ptm/students/${student_id}/concepts${qs}`);
    },
  },

  escalated: {
    list(): Promise<PTMReport[]> {
      return apiFetch<PTMReport[]>("/api/ptm/escalated");
    },

    override(id: string): Promise<{ status: string; delivered_via: string[] }> {
      return apiFetch(`/api/ptm/escalated/${id}/override`, { method: "POST" });
    },
  },
};
