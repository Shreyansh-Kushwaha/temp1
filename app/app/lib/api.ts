import type { PTMReport, QuestionnaireQuestion } from "@/app/lib/mock-data";

const BASE = "";

export interface QuestionnaireSubmission {
  engagement_rating?: number;
  concept_rating?: number;
  application_rating?: number;
  topics_correction?: string;
  next_month_topics?: string[];
  free_form_note?: string;
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
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  teachers: {
    list(): Promise<{ teacher_name: string }[]> {
      return apiFetch("/api/ptm/teachers");
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

    approve(
      id: string,
      teacher_note?: string
    ): Promise<{ status: string; delivered_via: string[] }> {
      return apiFetch(`/api/ptm/reports/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ teacher_note: teacher_note ?? null }),
      });
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
