"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Render free-tier cold starts can take ~50s. Poll fast at first, then back
// off so we don't hammer the server once it's clearly still booting.
const POLL_INTERVALS_MS = [2000, 2000, 3000, 3000, 5000, 5000, 8000];
const READY_HIDE_MS = 2200;

type Status = "checking" | "waking" | "ready";

export default function BackendStatusIndicator() {
  const [status, setStatus] = useState<Status>("checking");
  const [hidden, setHidden] = useState(false);
  const [hovered, setHovered] = useState(false);
  const attemptRef = useRef(0);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const ping = async () => {
      try {
        const res = await fetch(`${BASE}/health`, { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          // If the very first probe succeeded fast, just stay quiet.
          const elapsed = Date.now() - startedAtRef.current;
          if (attemptRef.current === 0 && elapsed < 1500) {
            setHidden(true);
            return;
          }
          setStatus("ready");
          // If we ever showed the "waking" state, the page made API calls
          // against a dead backend and now has stale empty data — reload so
          // every component refetches cleanly.
          const hadFailures = attemptRef.current > 0;
          window.setTimeout(() => {
            if (cancelled) return;
            if (hadFailures) {
              window.location.reload();
            } else {
              setHidden(true);
            }
          }, READY_HIDE_MS);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch {
        if (cancelled) return;
        attemptRef.current += 1;
        setStatus("waking");
        const idx = Math.min(attemptRef.current - 1, POLL_INTERVALS_MS.length - 1);
        timer = window.setTimeout(ping, POLL_INTERVALS_MS[idx]);
      }
    };

    ping();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (hidden) return null;

  const isReady = status === "ready";
  const expanded = hovered || isReady;

  return (
    <div
      className="fixed bottom-4 right-4 z-[90] pointer-events-auto"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-2 rounded-full bg-white pl-3 pr-3.5 py-2 shadow-[var(--ss-shadow-lg)] border transition-all duration-300 ease-out ${
          isReady
            ? "border-[var(--ss-success)]/30"
            : "border-[var(--ss-o-200)]"
        }`}
        style={{
          maxWidth: expanded ? 360 : 200,
        }}
      >
        {isReady ? (
          <CheckCircle2
            size={16}
            className="shrink-0 text-[var(--ss-success)]"
          />
        ) : (
          <Loader2
            size={16}
            className="shrink-0 animate-spin text-[var(--ss-o-500)]"
          />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-semibold leading-tight truncate ${
              isReady ? "text-[var(--ss-success)]" : "text-[var(--ss-i-900)]"
            }`}
          >
            {isReady ? "Backend ready" : "Waking backend…"}
          </p>
          <p
            className={`text-[11px] text-[var(--ss-i-500)] leading-snug overflow-hidden transition-all duration-300 ${
              expanded && !isReady ? "max-h-16 mt-0.5" : "max-h-0"
            }`}
          >
            The Render server sleeps when idle and takes ~30–60s to wake. The
            UI will reconnect automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
