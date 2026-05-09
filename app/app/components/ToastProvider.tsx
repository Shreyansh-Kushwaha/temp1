"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastKind = "error" | "success" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  show: (kind: ToastKind, message: string) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((kind: ToastKind, message: string) => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((prev) => [...prev, { id, kind, message }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      error: (m) => show("error", m),
      success: (m) => show("success", m),
      info: (m) => show("info", m),
    }),
    [show],
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
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const handle = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
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
