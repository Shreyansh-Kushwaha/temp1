"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronDown,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  GraduationCap,
  Lock,
  AlertCircle,
  Search,
} from "lucide-react";
import AmbientBackground from "@/app/components/AmbientBackground";
import { api } from "@/app/lib/api";
import { setAuth, DEMO_PASSWORD } from "@/app/lib/auth";

const ADMIN_OPTION = "__admin__";

export default function LoginPage() {
  const router = useRouter();
  const [teachers, setTeachers] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Magnetic mouse glow on the right panel
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    api.teachers
      .list()
      .then((rows) => {
        const names = rows.map((t) => t.teacher_name).filter(Boolean).sort();
        setTeachers(names);
      })
      .catch(() => setTeachers([]))
      .finally(() => setLoadingTeachers(false));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selected) {
      setError("Please choose who you're signing in as.");
      return;
    }
    if (password !== DEMO_PASSWORD) {
      setError("That password isn't right. Try 123456789 for the demo.");
      // shake the form
      formRef.current?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-8px)" },
          { transform: "translateX(8px)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 320, easing: "ease-in-out" }
      );
      return;
    }
    setSubmitting(true);
    if (selected === ADMIN_OPTION) {
      setAuth({ role: "admin", teacher_name: null });
    } else {
      setAuth({ role: "teacher", teacher_name: selected });
    }
    setTimeout(() => router.replace("/ptm/pending"), 350);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setGlowPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden text-white"
      style={{ background: "#0a0812" }}
    >
      <AmbientBackground />

      {/* ── Top brand strip ─────────────────────────────────────── */}
      <header className="relative z-10 px-6 md:px-10 pt-5 flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href="/"
            className="group inline-flex items-center gap-2.5 transition-opacity hover:opacity-90"
            aria-label="Go to home"
          >
            <span
              className="relative w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #FF6B1F, #C24808)",
                boxShadow: "0 0 22px rgba(255,107,31,0.65), inset 0 1px 0 rgba(255,255,255,0.4)",
              }}
            >
              <span
                className="text-white text-[13px] font-extrabold"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                S
              </span>
            </span>
            <div className="leading-none">
              <p
                className="text-sm font-bold tracking-tight text-white"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                Super Sheldon
              </p>
              <p className="text-[10px] text-white/40 mt-0.5 tracking-widest uppercase">
                PTM Agent
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-white/60"
        >
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </span>
          AI Systems Online
        </motion.span>
      </header>

      {/* ── Main split ──────────────────────────────────────────── */}
      <main className="relative z-10 grid lg:grid-cols-[1.15fr_0.85fr] items-start px-6 md:px-10 pt-6 lg:pt-8 pb-10 gap-8 lg:gap-6 max-w-[1500px] mx-auto">
        {/* ── LEFT: hero ──────────────────────────────────────── */}
        <section className="relative lg:min-h-[560px]">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="max-w-2xl"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-white/70 mb-7">
              <Sparkles size={11} className="text-[var(--ss-o-400)]" />
              Intelligent parent-teacher operating system
            </span>

            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] sm:leading-[1.02] tracking-tight break-words"
              style={{
                fontFamily: "var(--font-jakarta)",
                letterSpacing: "-0.035em",
              }}
            >
              <motion.span
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                className="block text-white"
              >
                The intelligent
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                className="block"
              >
                <span
                  style={{
                    background: "linear-gradient(110deg, #FFA14B 0%, #FF6B1F 50%, #C24808 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Parent–Teacher
                </span>
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
                className="block text-white/30"
              >
                agent.
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
              className="text-base md:text-lg text-white/55 leading-relaxed mt-7 max-w-lg"
            >
              Cinematic reports, transparent AI confidence, and student knowledge
              graphs — designed for teachers who care about every signal.
            </motion.p>

            <motion.ul
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 0.85 } } }}
              className="mt-8 space-y-2.5"
            >
              {[
                "Per-section confidence scoring + evidence",
                "Risk detection across attendance & engagement",
                "AI copilot grounded in your students' history",
              ].map((line) => (
                <motion.li
                  key={line}
                  variants={{
                    hidden: { opacity: 0, x: -8 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  className="flex items-center gap-2.5 text-[13px] text-white/70"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "var(--ss-o-400)",
                      boxShadow: "0 0 10px rgba(255,107,31,0.7)",
                    }}
                  />
                  {line}
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>

          {/* Orbital ring decoration */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1, rotate: 360 }}
            transition={{
              opacity: { duration: 1.2, delay: 0.4 },
              scale: { duration: 1.2, delay: 0.4 },
              rotate: { duration: 90, repeat: Infinity, ease: "linear" },
            }}
            className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full pointer-events-none hidden lg:block"
            style={{
              border: "1px solid rgba(255,107,31,0.18)",
              boxShadow: "inset 0 0 40px rgba(255,107,31,0.10), 0 0 60px rgba(255,107,31,0.10)",
            }}
          >
            <span
              className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
              style={{ background: "#FF6B1F", boxShadow: "0 0 14px #FF6B1F" }}
            />
          </motion.div>
        </section>

        {/* ── RIGHT: glass login panel ────────────────────────── */}
        <section
          onMouseMove={handleMouseMove}
          className="relative flex items-start justify-center pt-2 lg:pt-0"
        >
          <motion.form
            ref={formRef}
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.55 }}
            className="relative w-full max-w-[440px] z-10"
            style={{
              padding: "32px 28px 28px",
              borderRadius: 28,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
              backdropFilter: "blur(24px) saturate(140%)",
              WebkitBackdropFilter: "blur(24px) saturate(140%)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow:
                "0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)",
            }}
          >
            {/* Magnetic mouse glow */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-[28px] pointer-events-none"
              style={{
                background: `radial-gradient(280px 200px at ${glowPos.x}% ${glowPos.y}%, rgba(255,107,31,0.18), transparent 70%)`,
                opacity: 0.9,
                transition: "background 0.18s ease-out",
              }}
            />
            {/* Top sheen */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px rounded-t-[28px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
              }}
            />

            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-2">
                Welcome back
              </p>
              <h2
                className="text-[26px] font-extrabold leading-tight tracking-tight text-white"
                style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.02em", color: "#fff" }}
              >
                Step into your{" "}
                <span style={{ color: "var(--ss-o-400)" }}>workspace</span>
              </h2>
              <p className="text-[13px] text-white/50 mt-2 leading-relaxed">
                Choose your identity below. Selecting{" "}
                <span className="text-white/80 font-semibold">Administrator</span>{" "}
                unlocks every teacher.
              </p>

              {/* ── Identity dropdown ─────────────────── */}
              <div className="mt-7">
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">
                  Identity
                </label>
                <IdentityDropdown
                  options={teachers}
                  value={selected}
                  loading={loadingTeachers}
                  open={open}
                  onOpenChange={setOpen}
                  onChange={(v) => {
                    setSelected(v);
                    setError(null);
                  }}
                />
              </div>

              {/* ── Password ──────────────────────────── */}
              <div className="mt-5">
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">
                  Passphrase
                </label>
                <div
                  className="relative flex items-center rounded-2xl border border-white/10 bg-white/[0.05] focus-within:border-[var(--ss-o-400)]/60 focus-within:bg-white/[0.08] transition-colors overflow-hidden"
                  style={{
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                  }}
                >
                  <Lock size={14} className="ml-3.5 text-white/40 shrink-0" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="••••••••••"
                    className="flex-1 bg-transparent px-3 py-3 text-[14px] text-white placeholder:text-white/25 focus:outline-none tracking-widest font-medium"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="px-3 text-white/35 hover:text-white/70 transition-colors"
                    aria-label={showPassword ? "Hide passphrase" : "Show passphrase"}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[10px] text-white/30 mt-1.5 ml-0.5">
                  Demo passphrase:{" "}
                  <span className="font-mono text-white/60 tracking-wider">123456789</span>
                </p>
              </div>

              {/* ── Error ─────────────────────────────── */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <p className="mt-3 flex items-center gap-2 text-[12px] text-red-300/95 bg-red-400/10 border border-red-400/30 rounded-xl px-3 py-2">
                      <AlertCircle size={12} className="shrink-0" />
                      {error}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Submit ────────────────────────────── */}
              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="group relative mt-7 w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-bold tracking-wide overflow-hidden disabled:opacity-70"
                style={{
                  background: "linear-gradient(135deg, #FFA14B 0%, #FF6B1F 50%, #C24808 100%)",
                  color: "white",
                  fontFamily: "var(--font-jakarta)",
                  boxShadow:
                    "0 16px 36px rgba(255,107,31,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
                }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Entering…
                    </>
                  ) : (
                    <>
                      Enter workspace
                      <ArrowRight
                        size={15}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </>
                  )}
                </span>
                {/* Shimmer */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 -inset-x-1 pointer-events-none opacity-60"
                  style={{
                    background:
                      "linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
                    transform: "translateX(-120%)",
                    animation: "loginShimmer 3.2s ease-in-out infinite",
                  }}
                />
              </motion.button>

              <p className="text-[10px] text-white/35 text-center mt-5 leading-relaxed">
                Protected by Sheldon Labs · This is a closed beta workspace
              </p>
            </div>
          </motion.form>
        </section>
      </main>

      {/* Local keyframes for login-only motion */}
      <style>{`
        @keyframes loginShimmer {
          0% { transform: translateX(-120%); }
          50% { transform: translateX(120%); }
          100% { transform: translateX(120%); }
        }
      `}</style>
    </div>
  );
}

// ── Identity dropdown ────────────────────────────────────────────────────────

function IdentityDropdown({
  options,
  value,
  loading,
  open,
  onOpenChange,
  onChange,
}: {
  options: string[];
  value: string;
  loading: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, onOpenChange]);

  // Reset and focus the search every time the panel opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      // rAF lets the panel mount before we focus.
      const id = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const isAdmin = value === ADMIN_OPTION;
  const selectedLabel =
    value === ""
      ? "Select identity"
      : isAdmin
      ? "Administrator"
      : value;

  const q = query.trim().toLowerCase();
  // Prefix match on any word in the name. "a" → Alok / Anika, not Pandit.
  // "sha" → Alok Sharma (matches the "Sharma" word), not Akash.
  const filteredTeachers = q
    ? options.filter((n) =>
        n.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)),
      )
    : options;
  // Same prefix rule for Administrator so typing "a" still surfaces it.
  const showAdmin =
    !q || "administrator".startsWith(q) || "admin".startsWith(q);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="group relative w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-400)]/40 transition-all"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${
              isAdmin
                ? ""
                : value
                ? "bg-[var(--ss-o-500)]/15 border border-[var(--ss-o-500)]/30"
                : "bg-white/5 border border-white/10"
            }`}
            style={
              isAdmin
                ? {
                    background: "linear-gradient(135deg, #FF6B1F, #C24808)",
                    boxShadow: "0 0 14px rgba(255,107,31,0.55)",
                  }
                : undefined
            }
          >
            {isAdmin ? (
              <Shield size={12} className="text-white" />
            ) : value ? (
              <span
                className="text-[10px] font-bold text-[var(--ss-o-400)]"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                {initialsOf(value)}
              </span>
            ) : (
              <GraduationCap size={12} className="text-white/45" />
            )}
          </span>
          <span
            className={`text-[14px] font-semibold truncate ${
              value ? "text-white" : "text-white/40"
            }`}
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            {selectedLabel}
          </span>
          {isAdmin && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[var(--ss-o-500)]/15 text-[var(--ss-o-300)] border border-[var(--ss-o-500)]/40 shrink-0">
              All access
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`text-white/40 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-30 mt-2 w-full rounded-2xl border border-white/10 overflow-hidden"
            style={{
              background: "rgba(20, 14, 32, 0.92)",
              backdropFilter: "blur(24px) saturate(160%)",
              WebkitBackdropFilter: "blur(24px) saturate(160%)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {/* Search — type to filter the teacher list. */}
            <div
              className="px-2.5 pt-2.5 pb-2 border-b border-white/5 sticky top-0 z-10"
              style={{ background: "rgba(20, 14, 32, 0.95)" }}
            >
              <div className="relative flex items-center">
                <Search size={13} className="absolute left-3 text-white/40" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      onOpenChange(false);
                    } else if (e.key === "Enter" && filteredTeachers.length === 1) {
                      e.preventDefault();
                      onChange(filteredTeachers[0]);
                      onOpenChange(false);
                    }
                  }}
                  placeholder="Type a teacher name…"
                  className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-[var(--ss-o-400)]/50 focus:bg-white/[0.08] transition-colors"
                />
              </div>
            </div>

            <div className="max-h-[260px] overflow-y-auto py-1.5">
              {showAdmin && (
                <DropdownItem
                  accent
                  onClick={() => {
                    onChange(ADMIN_OPTION);
                    onOpenChange(false);
                  }}
                  selected={value === ADMIN_OPTION}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #FF6B1F, #C24808)",
                      boxShadow: "0 0 14px rgba(255,107,31,0.55)",
                    }}
                  >
                    <Shield size={12} className="text-white" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-bold text-white truncate"
                      style={{ fontFamily: "var(--font-jakarta)" }}
                    >
                      Administrator
                    </p>
                    <p className="text-[10px] text-white/45">
                      All teachers · all reports
                    </p>
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[var(--ss-o-500)]/15 text-[var(--ss-o-300)] border border-[var(--ss-o-500)]/40 shrink-0">
                    Admin
                  </span>
                </DropdownItem>
              )}

              {filteredTeachers.length > 0 && (
                <div className="px-3 py-1.5 mt-1">
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">
                    Teachers
                  </span>
                </div>
              )}

              {loading && (
                <div className="px-3 py-3 text-[12px] text-white/45">
                  Loading teachers…
                </div>
              )}

              {!loading && options.length === 0 && (
                <div className="px-3 py-3 text-[12px] text-white/45">
                  No teachers found in the database.
                </div>
              )}

              {!loading && options.length > 0 && filteredTeachers.length === 0 && !showAdmin && (
                <div className="px-3 py-3 text-[12px] text-white/45">
                  No match for <span className="text-white/70 font-semibold">&ldquo;{query}&rdquo;</span>.
                </div>
              )}

              {filteredTeachers.map((name) => (
                <DropdownItem
                  key={name}
                  onClick={() => {
                    onChange(name);
                    onOpenChange(false);
                  }}
                  selected={value === name}
                >
                  <span className="w-7 h-7 rounded-full bg-[var(--ss-o-500)]/15 border border-[var(--ss-o-500)]/30 flex items-center justify-center">
                    <span
                      className="text-[10px] font-bold text-[var(--ss-o-300)]"
                      style={{ fontFamily: "var(--font-jakarta)" }}
                    >
                      {initialsOf(name)}
                    </span>
                  </span>
                  <p
                    className="flex-1 text-[13px] font-semibold text-white/85 truncate"
                    style={{ fontFamily: "var(--font-jakarta)" }}
                  >
                    <Highlight text={name} query={q} />
                  </p>
                </DropdownItem>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DropdownItem({
  children,
  onClick,
  selected,
  accent = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  selected: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 transition-colors text-left ${
        selected ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
      } ${accent ? "border-b border-white/5" : ""}`}
    >
      {children}
      {selected && (
        <span
          className="w-1.5 h-1.5 rounded-full ml-auto"
          style={{ background: "#FF6B1F", boxShadow: "0 0 8px #FF6B1F" }}
        />
      )}
    </button>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx === -1) return <>{text}</>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return (
    <>
      {before}
      <span className="text-[var(--ss-o-300)] font-bold">{match}</span>
      {after}
    </>
  );
}
