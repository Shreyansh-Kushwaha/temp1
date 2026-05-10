"use client";

import { AlertCircle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ─── Quick-toast (existing API — auto-dismisses after 4.5s) ──────────────
type ToastKind = "error" | "success" | "info";

interface QuickToast {
  id: number;
  flavor: "quick";
  kind: ToastKind;
  message: string;
}

// ─── Task-toast (new — pending stays until succeed/fail is called) ───────
type TaskState = "pending" | "success" | "error";

interface TaskAction {
  label: string;
  onClick: () => void;
}

interface TaskToast {
  id: number;
  flavor: "task";
  taskId: string;
  state: TaskState;
  message: string;
  action?: TaskAction;
}

type Toast = QuickToast | TaskToast;

interface QuickApi {
  show: (kind: ToastKind, message: string) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
}

interface TaskApi {
  start: (taskId: string, message: string) => void;
  succeed: (taskId: string, message: string, action?: TaskAction) => void;
  fail: (taskId: string, message: string, action?: TaskAction) => void;
  cancel: (taskId: string) => void; // remove without transition (rare)
}

interface ToastApi extends QuickApi {
  task: TaskApi;
}

const ToastContext = createContext<ToastApi | null>(null);

const QUICK_DISMISS_MS = 4500;
const TASK_SUCCESS_DISMISS_MS = 8000;
const TASK_ERROR_DISMISS_MS = 12000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((kind: ToastKind, message: string) => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((prev) => [...prev, { id, flavor: "quick", kind, message }]);
  }, []);

  const taskApi = useMemo<TaskApi>(
    () => ({
      start: (taskId, message) => {
        idRef.current += 1;
        const id = idRef.current;
        setToasts((prev) => {
          // If a task with this taskId already exists, replace it (e.g. retry).
          const filtered = prev.filter(
            (t) => !(t.flavor === "task" && t.taskId === taskId),
          );
          return [
            ...filtered,
            { id, flavor: "task", taskId, state: "pending", message },
          ];
        });
      },
      succeed: (taskId, message, action) => {
        setToasts((prev) =>
          prev.map((t) =>
            t.flavor === "task" && t.taskId === taskId
              ? { ...t, state: "success", message, action }
              : t,
          ),
        );
      },
      fail: (taskId, message, action) => {
        setToasts((prev) =>
          prev.map((t) =>
            t.flavor === "task" && t.taskId === taskId
              ? { ...t, state: "error", message, action }
              : t,
          ),
        );
      },
      cancel: (taskId) => {
        setToasts((prev) =>
          prev.filter((t) => !(t.flavor === "task" && t.taskId === taskId)),
        );
      },
    }),
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      error: (m) => show("error", m),
      success: (m) => show("success", m),
      info: (m) => show("info", m),
      task: taskApi,
    }),
    [show, taskApi],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-20 left-4 right-4 sm:top-4 sm:left-auto sm:right-4 z-[100] flex flex-col gap-2 sm:max-w-sm pointer-events-none"
    >
      {toasts.map((t) =>
        t.flavor === "quick" ? (
          <QuickToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ) : (
          <TaskToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ),
      )}
    </div>
  );
}

function QuickToastItem({
  toast,
  onDismiss,
}: {
  toast: QuickToast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const handle = window.setTimeout(() => onDismiss(toast.id), QUICK_DISMISS_MS);
    return () => window.clearTimeout(handle);
  }, [toast.id, onDismiss]);

  const tone = TONE[toast.kind];
  const Icon = tone.icon;

  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border-l-4 bg-white p-3.5 shadow-[var(--ss-shadow-lg)] ${tone.border}`}
      style={{ animation: "ss-toast-in 180ms ease-out" }}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${tone.icon_color}`} />
      <p className="flex-1 text-sm text-[var(--ss-i-900)] leading-snug">
        {toast.message}
      </p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="text-[var(--ss-i-400)] hover:text-[var(--ss-i-700)] transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function TaskToastItem({
  toast,
  onDismiss,
}: {
  toast: TaskToast;
  onDismiss: (id: number) => void;
}) {
  // Auto-dismiss only after the task transitions out of pending.
  useEffect(() => {
    if (toast.state === "pending") return;
    const ttl =
      toast.state === "success" ? TASK_SUCCESS_DISMISS_MS : TASK_ERROR_DISMISS_MS;
    const handle = window.setTimeout(() => onDismiss(toast.id), ttl);
    return () => window.clearTimeout(handle);
  }, [toast.state, toast.id, onDismiss]);

  const tone =
    toast.state === "success"
      ? TASK_TONE.success
      : toast.state === "error"
        ? TASK_TONE.error
        : TASK_TONE.pending;
  const Icon = tone.icon;
  const iconClass =
    toast.state === "pending"
      ? `${tone.icon_color} animate-spin`
      : tone.icon_color;

  function handleAction() {
    toast.action?.onClick();
    onDismiss(toast.id);
  }

  return (
    <div
      role={toast.state === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border-l-4 bg-white p-3.5 shadow-[var(--ss-shadow-lg)] ${tone.border}`}
      style={{ animation: "ss-toast-in 180ms ease-out" }}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--ss-i-900)] leading-snug">
          {toast.message}
        </p>
        {toast.action && toast.state !== "pending" && (
          <button
            type="button"
            onClick={handleAction}
            className={`mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold min-h-[36px] sm:min-h-0 ${tone.button}`}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      {toast.state !== "pending" && (
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
          className="text-[var(--ss-i-400)] hover:text-[var(--ss-i-700)] transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

const TONE = {
  error: {
    border: "border-l-[var(--ss-error)]",
    icon: AlertCircle,
    icon_color: "text-[var(--ss-error)]",
  },
  success: {
    border: "border-l-[var(--ss-success)]",
    icon: CheckCircle2,
    icon_color: "text-[var(--ss-success)]",
  },
  info: {
    border: "border-l-[var(--ss-info)]",
    icon: Info,
    icon_color: "text-[var(--ss-info)]",
  },
} as const;

const TASK_TONE = {
  pending: {
    border: "border-l-[var(--ss-o-500)]",
    icon: Loader2,
    icon_color: "text-[var(--ss-o-500)]",
    button: "bg-[var(--ss-o-500)] text-white hover:bg-[var(--ss-o-600)]",
  },
  success: {
    border: "border-l-[var(--ss-success)]",
    icon: CheckCircle2,
    icon_color: "text-[var(--ss-success)]",
    button: "bg-[var(--ss-o-500)] text-white hover:bg-[var(--ss-o-600)]",
  },
  error: {
    border: "border-l-[var(--ss-error)]",
    icon: XCircle,
    icon_color: "text-[var(--ss-error)]",
    button: "bg-white border border-[var(--ss-i-200)] text-[var(--ss-i-700)] hover:bg-[var(--ss-i-50)]",
  },
} as const;
