"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Download,
  Sparkles,
  Volume2,
  Loader2,
  AlertCircle,
  ChevronDown,
  FileText,
} from "lucide-react";
import type { AudioSummary } from "@/app/lib/mock-data";
import { api } from "@/app/lib/api";
import WaveformBars from "@/app/components/WaveformBars";

function fmt(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return "--:--";
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** Wait for the browser's voice list to populate. Some browsers fire `voiceschanged`
 *  asynchronously — speaking before that fires often returns synthesis-failed. */
function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    let done = false;
    const handler = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0 && !done) {
        done = true;
        window.speechSynthesis.removeEventListener("voiceschanged", handler);
        resolve(v);
      }
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    window.setTimeout(() => {
      if (done) return;
      done = true;
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(window.speechSynthesis.getVoices());
    }, timeoutMs);
  });
}

/** Sentence-sized chunks. Long single utterances often fail with synthesis-failed. */
function chunkScript(text: string, maxChars = 180): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length <= maxChars) {
      buf = buf ? `${buf} ${s}` : s;
    } else {
      if (buf) out.push(buf);
      buf = s.length <= maxChars ? s : s.slice(0, maxChars);
    }
  }
  if (buf) out.push(buf);
  return out;
}

export default function AudioSummaryCard({
  reportId,
  hasScript,
}: {
  reportId: string;
  hasScript: boolean;
}) {
  const [summary, setSummary] = useState<AudioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const speakingChunksRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const [showTranscript, setShowTranscript] = useState(false);

  // Initial fetch — only treat a cached summary as "playable" if it has an audio_url.
  // (A leftover browser-provider row with no audio is useless and would dead-end the user.)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await api.reports.audioSummary(reportId);
        if (cancelled) return;
        if (existing && existing.audio_url) {
          setSummary(existing);
          if (existing.duration_seconds) setDuration(existing.duration_seconds);
        } else {
          setSummary(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load audio");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  // Cleanup any in-flight playback when unmounting / changing reports
  useEffect(() => {
    return () => {
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  function stopAll() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speakingChunksRef.current.cancelled = true;
    if (elapsedTimerRef.current) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    setPlaying(false);
    setProgress(0);
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await api.reports.createAudioSummary(reportId);
      if (!result.audio_url) {
        // Server fell back to browser provider — surface why and keep the generate UI
        setSummary(null);
        setError(
          "The TTS provider returned no audio file. Set TTS_PROVIDER=gtts (or huggingface) on the backend and retry."
        );
        return;
      }
      setSummary(result);
      if (result.duration_seconds) setDuration(result.duration_seconds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate audio");
    } finally {
      setGenerating(false);
    }
  }

  async function togglePlay() {
    if (!summary) return;
    if (playing) {
      stopAll();
      return;
    }
    setError(null);

    if (summary.audio_url) {
      // HTML5 audio path
      let el = audioRef.current;
      if (!el) {
        el = new Audio(summary.audio_url);
        audioRef.current = el;
        el.addEventListener("loadedmetadata", () => {
          if (el && isFinite(el.duration)) setDuration(el.duration);
        });
        el.addEventListener("timeupdate", () => {
          if (el && isFinite(el.duration) && el.duration > 0) {
            setProgress((el.currentTime / el.duration) * 100);
          }
        });
        el.addEventListener("ended", () => {
          setPlaying(false);
          setProgress(100);
        });
      }
      void el.play().then(() => setPlaying(true)).catch((err) => {
        setError(err instanceof Error ? err.message : "Playback failed");
      });
      return;
    }

    // Browser TTS path — gracefully degrade
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setError("Browser speech is not available here. Read the script below.");
      setShowTranscript(true);
      return;
    }

    // Make sure no stale utterance is pending (Chrome can get stuck)
    window.speechSynthesis.cancel();
    speakingChunksRef.current = { cancelled: false };

    const voices = await waitForVoices();
    if (voices.length === 0) {
      setError(
        "No speech voices available in this browser. Read the script below — or open the report in a normal browser tab."
      );
      setShowTranscript(true);
      return;
    }

    const preferred =
      voices.find((v) => /en[-_]/i.test(v.lang) && /female|samantha|zira|google.*us/i.test(v.name)) ??
      voices.find((v) => /en[-_]/i.test(v.lang)) ??
      voices[0];

    const chunks = chunkScript(summary.script);
    if (chunks.length === 0) {
      setError("No script to speak.");
      return;
    }

    setPlaying(true);
    setProgress(0);
    const total = summary.duration_seconds ?? 50;
    const start = Date.now();
    elapsedTimerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setProgress(Math.min(99, (elapsed / total) * 100));
    }, 200);

    const speakChunk = (i: number) => {
      if (speakingChunksRef.current.cancelled) return;
      if (i >= chunks.length) {
        setProgress(100);
        setPlaying(false);
        if (elapsedTimerRef.current) {
          window.clearInterval(elapsedTimerRef.current);
          elapsedTimerRef.current = null;
        }
        return;
      }
      const utt = new SpeechSynthesisUtterance(chunks[i]);
      utt.voice = preferred;
      utt.lang = preferred.lang || "en-US";
      utt.rate = 1.0;
      utt.pitch = 1.0;
      utt.onend = () => speakChunk(i + 1);
      utt.onerror = (ev) => {
        // If only the first chunk fails, surface the issue. If a later one fails,
        // try to keep going — partial audio is better than silence.
        if (i === 0) {
          if (elapsedTimerRef.current) {
            window.clearInterval(elapsedTimerRef.current);
            elapsedTimerRef.current = null;
          }
          setPlaying(false);
          setShowTranscript(true);
          if (ev.error === "synthesis-failed" || ev.error === "audio-busy" || ev.error === "audio-hardware") {
            setError(
              "Your browser couldn't synthesize speech here (this is common in Codespaces previews). The script is below — open in a regular browser tab to listen."
            );
          } else if (ev.error === "not-allowed") {
            setError("Speech blocked by the browser. Click play again after interacting with the page.");
          } else {
            setError(`Speech error: ${ev.error}`);
          }
        } else {
          // Skip the broken chunk and keep going
          speakChunk(i + 1);
        }
      };
      window.speechSynthesis.speak(utt);
    };
    speakChunk(0);
  }

  // ── Render states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--ss-i-200)] bg-white shadow-[var(--ss-shadow)] p-5 animate-pulse">
        <div className="h-3 w-32 bg-[var(--ss-i-100)] rounded mb-3" />
        <div className="h-10 w-full bg-[var(--ss-i-100)] rounded-xl" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-2xl border border-[var(--ss-i-200)] bg-white shadow-[var(--ss-shadow)] p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-full bg-[var(--ss-o-100)] flex items-center justify-center">
            <Volume2 size={13} className="text-[var(--ss-o-600)]" />
          </span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ss-i-500)]">
            Audio Summary
          </p>
        </div>
        <p className="text-xs text-[var(--ss-i-500)] mb-3 leading-relaxed">
          Generate a 45–60 second voice summary parents can listen to on the go.
        </p>
        <button
          onClick={generate}
          disabled={generating || !hasScript}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full bg-[var(--ss-o-500)] text-white text-xs font-semibold hover:bg-[var(--ss-o-600)] transition-colors disabled:opacity-60 shadow-[var(--ss-shadow-brand)]"
        >
          {generating ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Sparkles size={13} /> Generate audio
            </>
          )}
        </button>
        {!hasScript && (
          <p className="text-[10px] text-[var(--ss-i-400)] mt-2 italic">
            Audio script will appear after the next regeneration.
          </p>
        )}
        {error && (
          <p className="text-[11px] text-red-600 mt-2 flex items-center gap-1">
            <AlertCircle size={11} /> {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--ss-i-200)] bg-white shadow-[var(--ss-shadow)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[var(--ss-o-100)] flex items-center justify-center">
            <Volume2 size={13} className="text-[var(--ss-o-600)]" />
          </span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ss-i-500)]">
            Audio Summary
          </p>
        </div>
        <span className="text-[10px] font-semibold text-[var(--ss-i-400)] uppercase tracking-wider">
          {summary.provider === "huggingface" ? "HF · MP3" : "Browser TTS"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <motion.button
          onClick={togglePlay}
          whileTap={{ scale: 0.94 }}
          className="w-11 h-11 rounded-full bg-[var(--ss-o-500)] hover:bg-[var(--ss-o-600)] text-white flex items-center justify-center shrink-0 shadow-[var(--ss-shadow-brand)]"
          type="button"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </motion.button>

        <div className="flex-1 min-w-0">
          <WaveformBars playing={playing} />
        </div>

        <div className="text-right shrink-0">
          <p className="text-[10px] text-[var(--ss-i-400)]">
            {fmt((duration ?? 0) * (progress / 100))} / {fmt(duration)}
          </p>
        </div>
      </div>

      <div className="mt-3 h-1 rounded-full bg-[var(--ss-i-100)] overflow-hidden">
        <div
          className="h-full bg-[var(--ss-o-500)] transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={generate}
          disabled={generating}
          className="text-[11px] font-semibold text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)] flex items-center gap-1 disabled:opacity-60"
          type="button"
        >
          {generating ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Sparkles size={11} />
          )}
          Regenerate
        </button>
        {summary.audio_url && (
          <a
            href={summary.audio_url}
            download
            className="text-[11px] font-semibold text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)] flex items-center gap-1"
          >
            <Download size={11} /> Download
          </a>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-red-600 mt-2 flex items-start gap-1.5 leading-relaxed">
          <AlertCircle size={11} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </p>
      )}

      {/* Readable script — fallback when speech fails or just to skim */}
      {summary.script && (
        <div className="mt-3 border-t border-[var(--ss-i-100)] pt-3">
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)] transition-colors"
          >
            <span className="inline-flex items-center gap-1.5">
              <FileText size={11} />
              {showTranscript ? "Hide" : "Read"} transcript
            </span>
            <ChevronDown
              size={12}
              className={`transition-transform ${showTranscript ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {showTranscript && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="text-[12px] text-[var(--ss-i-600)] leading-relaxed mt-2 italic overflow-hidden"
              >
                &ldquo;{summary.script}&rdquo;
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
