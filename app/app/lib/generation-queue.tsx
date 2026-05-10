"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";

import { api, ApiError, type GenerateFromSessionsBody } from "@/app/lib/api";
import { useToast } from "@/app/components/ToastProvider";

// State lives only in memory — refresh kills tracking on purpose, per spec.
// Idempotency on parallel duplicate generations is the backend's job.

interface GenerationQueueApi {
  /**
   * Kicks off a generation in the background and shows a "Generating…" toast.
   * Returns the taskId so callers can correlate (rarely needed).
   * Safe to call multiple times in quick succession — each generates its
   * own toast and runs in parallel.
   */
  enqueue: (req: GenerateFromSessionsBody) => string;
}

const GenerationQueueContext = createContext<GenerationQueueApi | null>(null);

export function GenerationQueueProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { task } = useToast();
  // Increment-only counter for unique taskIds. Survives re-renders within a
  // single page life — fine since the provider sits at the app root.
  const counterRef = useRef(0);

  const enqueue = useCallback(
    (req: GenerateFromSessionsBody): string => {
      counterRef.current += 1;
      const taskId = `gen-${Date.now()}-${counterRef.current}`;
      const studentName = (req.student_name || "Student").trim();

      task.start(taskId, `Generating report for ${studentName}…`);

      // Fire and forget — never await. Errors are surfaced via the toast.
      void runGeneration(req, taskId, studentName);

      return taskId;
    },
    // runGeneration captures task + router via closure, both stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task],
  );

  // Defined inside provider so it captures the current task + router.
  async function runGeneration(
    req: GenerateFromSessionsBody,
    taskId: string,
    studentName: string,
  ) {
    try {
      const result = await api.reports.generateFromSessions(req);
      task.succeed(taskId, `Report for ${studentName} is ready`, {
        label: "Open",
        onClick: () => router.push(`/ptm/${result.report_id}?generated=1`),
      });
    } catch (e) {
      // Duplicate-report (HTTP 409) is a benign condition: the student already
      // has an active report for this month. Show "Open" so the teacher can
      // jump straight to the existing draft instead of getting a Retry button
      // that's guaranteed to fail again.
      if (e instanceof ApiError && e.status === 409) {
        const detail = (e.data as { detail?: { existing_report_id?: string } } | null)?.detail;
        const existingId = detail?.existing_report_id;
        if (existingId) {
          task.fail(
            taskId,
            `${studentName} already has a report for this month — open the existing one.`,
            {
              label: "Open",
              onClick: () => router.push(`/ptm/${existingId}`),
            },
          );
          return;
        }
      }

      const reason =
        e instanceof ApiError
          ? e.detail || `HTTP ${e.status}`
          : e instanceof Error
            ? e.message
            : "Unknown error";
      task.fail(
        taskId,
        `Couldn't generate report for ${studentName}: ${reason}`,
        {
          label: "Retry",
          onClick: () => enqueue(req),
        },
      );
    }
  }

  const apiValue = useMemo<GenerationQueueApi>(() => ({ enqueue }), [enqueue]);

  return (
    <GenerationQueueContext.Provider value={apiValue}>
      {children}
    </GenerationQueueContext.Provider>
  );
}

export function useGenerationQueue(): GenerationQueueApi {
  const ctx = useContext(GenerationQueueContext);
  if (!ctx) {
    throw new Error(
      "useGenerationQueue must be used inside <GenerationQueueProvider>",
    );
  }
  return ctx;
}
