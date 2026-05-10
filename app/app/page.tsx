"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight, Sparkles, Zap, CheckCircle2, RefreshCw, Bot,
  Shield, Clock, Send, ChevronDown, Star,
} from "lucide-react";
import { motion, useTransform } from "framer-motion";
import {
  ScrollPathSystem,
  ScrollPathProvider,
  useSectionReach,
} from "./components/ScrollPathSystem";

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
];

const STATS = [
  { label: "Reports generated", sub: "across April 2026",  count: 500, suffix: "+",  raw: "500+" },
  { label: "Active teachers",   sub: "using the platform", count: 65,  suffix: "+",  raw: "65+"  },
  { label: "Per report",        sub: "from sessions to draft", count: null, suffix: "", raw: "<30s" },
];

const STEPS = [
  {
    number: "01", Icon: Zap,
    title: "Pick sessions, AI pre-fills the form",
    description: "Choose a teacher, select a student, then pick up to 4 past sessions. The form auto-drafts engagement, highlights and goals from the session transcripts — you just review and tweak before hitting Generate.",
  },
  {
    number: "02", Icon: Bot,
    title: "GPT-5.1 writes the full report",
    description: "Azure OpenAI GPT-5.1 reads the session transcripts and your notes, then writes a parent-friendly report — strengths, milestones, confidence trend, action items, audio summary. Generation runs in the background, so you can keep working.",
  },
  {
    number: "03", Icon: CheckCircle2,
    title: "Approve once, parents get a branded PDF",
    description: "Draft lands in the approval queue. One click to approve — the system renders a print-ready PDF, emails it to the parent with a branded message, and logs the delivery for audit. Every send is visible on the Logs page with a one-click resend.",
  },
];

const FEATURES = [
  {
    size: "large", Icon: Bot, tag: "AI-powered",
    title: "Reports that actually sound human",
    description: "Azure OpenAI GPT-5.1 writes every section in warm, parent-friendly language — no jargon, no boilerplate. Strengths, milestones, confidence trend, homework effort, recommended resources, plus an optional voice-narrated audio summary. Form auto-fill drafts the teacher's assessment from the session transcripts, so the human work is review, not writing.",
  },
  {
    size: "small", Icon: Shield, tag: "Quality control",
    title: "Inferred sections are clearly flagged",
    description: "Any section the AI had to guess is highlighted in amber so teachers know exactly what to verify before approving.",
  },
  {
    size: "small", Icon: RefreshCw, tag: "Feedback loop",
    title: "2-cycle regeneration, then escalate",
    description: "Teachers reject → answer a short questionnaire → AI regenerates with corrections. After 2 cycles, the report lands on the Escalated queue for a manager override.",
  },
  {
    size: "small", Icon: Send, tag: "Delivery",
    title: "Branded PDF straight to the parent",
    description: "Approval triggers a Playwright-rendered PDF, attached to a branded email sent over Gmail SMTP. Every send is logged on the Logs page — status, recipient, error, with a one-click resend.",
  },
  {
    size: "small", Icon: Clock, tag: "Operations",
    title: "Support queue + audit trail built in",
    description: "Missing parent emails, failed sends and other anomalies auto-raise tickets on the Issues page so the support team can chase them. A test-mode env var routes every email to a QA inbox until you're ready to go live.",
  },
];

const TESTIMONIALS = [
  {
    quote: "I used to spend 45 minutes per student writing reports. Now I review, add a line, and approve. The AI picks up things I would have missed — like noting that Alara asked especially good questions this month.",
    name: "Ankita R.", role: "Maths Teacher · Sheldon Labs", initials: "AR",
  },
  {
    quote: "Parents love the new format. It's specific, warm, and actually tells them what to do at home. One parent told me it was the most useful school communication she'd ever received.",
    name: "Preksha S.", role: "English Teacher · Sheldon Labs", initials: "PS",
  },
];

const FAQS = [
  { q: "How does the AI know what to write?",      a: "It reads the session transcripts from your Wise sessions — the actual notes from each class — plus the teacher assessment form. We auto-draft the form from the same transcripts, so the human work is review and tweak rather than writing from scratch." },
  { q: "What if the AI gets something wrong?",     a: "Inferred sections are highlighted in amber so teachers know what to verify. If anything is off, reject the report, fill in a short questionnaire, and GPT-5.1 regenerates with your corrections baked in. After 2 cycles it auto-escalates to a manager." },
  { q: "How many sessions should I select?",       a: "Up to 4. We recommend the most recent 3–4 so the report reflects current progress rather than older material." },
  { q: "Where is the data stored?",                a: "Session transcripts stay in the existing MongoDB. Generated reports + version history live in Supabase Postgres. Rendered PDFs are uploaded to Supabase Storage. PII never reaches the model — student first name, grade and subject are the only personal fields in the prompt." },
  { q: "How are emails actually sent to parents?", a: "Gmail SMTP via the support@supersheldon.com Workspace account. Each send produces a row on the Logs page (status, recipient, sent_at, error). Anything that fails or skips can be one-click resent. The Approve modal also lets the teacher pick a custom recipient instead of the on-record parent email when they want to test or send to a different address." },
  { q: "What if a student has no parent email on record?", a: "The approval still succeeds and the PDF is stored — but instead of sending, the system opens an issue on the Issues page so the support team can chase the address. Once Wise has the email, hit Resend on the original log row and it goes out." },
  { q: "Does it work on mobile?",                  a: "Yes — the navbar collapses to a drawer, tables become stacked cards, every action button is at least 44px tap-target. Teachers can review the Pending queue and approve from their phone during the day." },
];

/* ─────────────────────────────────────────────
   HOOKS
───────────────────────────────────────────── */

function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    const h = () => setY(window.scrollY);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return y;
}

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function useCountUp(end: number | null, active: boolean, duration = 1400) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active || end === null) return;
    let frame = 0;
    const total = Math.round(duration / 16);
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const id = setInterval(() => {
      frame++;
      setCount(Math.round(easeOut(Math.min(frame / total, 1)) * end));
      if (frame >= total) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [active, end, duration]);
  return count;
}

function useTilt(strength = 10) {
  const ref = useRef<HTMLDivElement>(null);
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width  - 0.5) * strength;
    const y = ((e.clientY - r.top)  / r.height - 0.5) * strength;
    el.style.transform    = `perspective(900px) rotateY(${x}deg) rotateX(${-y}deg) translateY(-4px)`;
    el.style.boxShadow    = `${-x * 1.5}px ${y * 1.5 + 18}px 44px rgba(255,107,31,0.13)`;
  };
  const onMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 0.55s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.55s ease";
    el.style.transform  = "";
    el.style.boxShadow  = "";
    setTimeout(() => { if (el) el.style.transition = ""; }, 560);
  };
  const onMouseEnter = () => {
    const el = ref.current;
    if (el) el.style.transition = "transform 0.1s ease, box-shadow 0.1s ease";
  };
  return { ref, onMouseMove, onMouseLeave, onMouseEnter };
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */

function StatItem({ stat, active }: { stat: typeof STATS[0]; active: boolean }) {
  const count  = useCountUp(stat.count, active);
  const [hov, setHov] = useState(false);
  return (
    <div
      className="text-center"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div
        className="text-4xl font-extrabold mb-1 inline-block"
        style={{
          fontFamily: "var(--font-jakarta)",
          background: "linear-gradient(90deg, #FF6B1F, #ff9f5a)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          transform: hov ? "scale(1.1)" : "scale(1)",
          transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {stat.count !== null ? `${count}${stat.suffix}` : stat.raw}
      </div>
      <div className="text-sm font-semibold mb-0.5" style={{ color: "#0F1115" }}>{stat.label}</div>
      <div className="text-xs" style={{ color: "#8A91A1" }}>{stat.sub}</div>
    </div>
  );
}

function StepCard({ step, index, inView }: { step: typeof STEPS[0]; index: number; inView: boolean }) {
  const tilt = useTilt(8);
  const [hov, setHov] = useState(false);
  // React when scroll path arrives in the How It Works section (0.28–0.44)
  const pathNear = useSectionReach(0.27 + index * 0.04, 0.30 + index * 0.04, 0.44);
  // Hoist unconditionally — must not be called inside a ternary
  const pathShadow = useTransform(
    pathNear,
    [0, 1],
    ["0 4px 12px rgba(15,17,21,0.06)", "0 4px 32px rgba(255,107,31,0.18)"]
  );
  return (
    <div style={{
      opacity: inView ? 1 : 0,
      transform: inView ? "translateY(0)" : "translateY(48px)",
      transition: `opacity 0.65s ease ${index * 0.15}s, transform 0.65s cubic-bezier(0.34,1.56,0.64,1) ${index * 0.15}s`,
    }}>
      <motion.div
        ref={tilt.ref}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={() => { tilt.onMouseLeave(); setHov(false); }}
        onMouseEnter={() => { tilt.onMouseEnter(); setHov(true); }}
        className="relative rounded-2xl p-8 h-full"
        style={{
          background: "#ffffff",
          border: `1px solid ${hov ? "#FFE0C7" : "#E5E8EE"}`,
          // Path arrival: subtle orange glow on the card
          boxShadow: hov ? undefined : pathShadow,
          cursor: "default",
          willChange: "transform",
          transition: "border-color 0.3s ease",
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-6"
          style={{
            background: index === 1 ? "#FF6B1F" : "#FFF1E6",
            color: index === 1 ? "white" : "#FF6B1F",
            border: index === 1 ? "none" : "1px solid #FFE0C7",
            fontFamily: "var(--font-jakarta)",
            transform: hov ? "scale(1.15) rotate(-6deg)" : "scale(1) rotate(0deg)",
            transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {step.number}
        </div>
        <step.Icon
          size={20}
          className="mb-4"
          style={{
            color: "#FF6B1F",
            display: "block",
            transform: hov ? "scale(1.25) rotate(-10deg)" : "scale(1) rotate(0deg)",
            transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        />
        <h3 className="text-lg font-bold mb-3" style={{ fontFamily: "var(--font-jakarta)", color: "#0F1115" }}>{step.title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "#5B6271" }}>{step.description}</p>
      </motion.div>
    </div>
  );
}

function SmallFeatureCard({ feat, index, inView }: { feat: typeof FEATURES[0]; index: number; inView: boolean }) {
  const tilt = useTilt(8);
  const [hov, setHov] = useState(false);
  const Icon = feat.Icon;
  // React when path is in the Features section (0.44–0.60)
  const pathNear   = useSectionReach(0.44 + index * 0.03, 0.47 + index * 0.03, 0.60);
  const pathShadow = useTransform(
    pathNear,
    [0, 1],
    ["none", "0 4px 28px rgba(255,107,31,0.16)"]
  );
  return (
    <div style={{
      opacity: inView ? 1 : 0,
      transform: inView ? "translateY(0)" : "translateY(48px)",
      transition: `opacity 0.55s ease ${(index + 1) * 0.1}s, transform 0.55s cubic-bezier(0.34,1.56,0.64,1) ${(index + 1) * 0.1}s`,
    }}>
      <motion.div
        ref={tilt.ref}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={() => { tilt.onMouseLeave(); setHov(false); }}
        onMouseEnter={() => { tilt.onMouseEnter(); setHov(true); }}
        className="rounded-3xl p-7 h-full"
        style={{
          background: hov ? "#ffffff" : "#FFF8F2",
          border: `1px solid ${hov ? "#FFE0C7" : "#E5E8EE"}`,
          boxShadow: pathShadow,
          cursor: "default",
          willChange: "transform",
          transition: "background 0.3s ease, border-color 0.3s ease",
        }}
      >
        <span
          className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4"
          style={{ background: "#F2F4F7", color: "#5B6271", border: "1px solid #E5E8EE" }}
        >
          {feat.tag}
        </span>
        <Icon
          size={22}
          className="mb-4"
          style={{
            color: "#FF6B1F",
            display: "block",
            transform: hov ? "scale(1.25) rotate(-10deg)" : "scale(1) rotate(0deg)",
            transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        />
        <h3 className="text-base font-bold mb-2" style={{ fontFamily: "var(--font-jakarta)", color: "#0F1115" }}>{feat.title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "#5B6271" }}>{feat.description}</p>
      </motion.div>
    </div>
  );
}

function TestimonialCard({ t, index, inView }: { t: typeof TESTIMONIALS[0]; index: number; inView: boolean }) {
  const tilt = useTilt(6);
  const [hov, setHov] = useState(false);
  return (
    <div style={{
      opacity: inView ? 1 : 0,
      transform: inView ? "translateY(0)" : "translateY(48px)",
      transition: `opacity 0.65s ease ${index * 0.2}s, transform 0.65s cubic-bezier(0.34,1.56,0.64,1) ${index * 0.2}s`,
    }}>
      <div
        ref={tilt.ref}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={() => { tilt.onMouseLeave(); setHov(false); }}
        onMouseEnter={() => { tilt.onMouseEnter(); setHov(true); }}
        className="rounded-3xl p-8 h-full"
        style={{
          background: "#ffffff",
          border: `1px solid ${hov ? "#FFE0C7" : "#E5E8EE"}`,
          boxShadow: hov ? undefined : "0 4px 12px rgba(15,17,21,0.06)",
          cursor: "default",
          willChange: "transform",
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        }}
      >
        {/* Decorative quote mark */}
        <div style={{
          fontSize: 72,
          lineHeight: 1,
          fontFamily: "Georgia, serif",
          color: "#FF6B1F",
          opacity: hov ? 0.18 : 0.07,
          marginTop: -8,
          marginBottom: -20,
          transition: "opacity 0.4s ease",
          userSelect: "none",
        }}>
          &ldquo;
        </div>

        {/* Stars */}
        <div className="flex gap-1 mb-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={14}
              fill="#FF6B1F"
              style={{
                color: "#FF6B1F",
                transform: hov ? `scale(1.2) translateY(${[0,-2,-3,-2,0][i]}px)` : "scale(1)",
                transition: `transform 0.3s ease ${i * 0.04}s`,
              }}
            />
          ))}
        </div>

        <p className="text-base leading-relaxed mb-6" style={{ color: "#2A2E36" }}>
          &ldquo;{t.quote}&rdquo;
        </p>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{
              background: "#FF6B1F",
              transform: hov ? "scale(1.12)" : "scale(1)",
              transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            {t.initials}
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "#0F1115" }}>{t.name}</div>
            <div className="text-xs" style={{ color: "#8A91A1" }}>{t.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */

export default function LandingPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollY = useScrollY();

  // Scroll-reveal refs
  const statsReveal    = useInView(0.2);
  const stepsReveal    = useInView(0.1);
  const featReveal     = useInView(0.1);
  const testReveal     = useInView(0.1);
  const faqReveal      = useInView(0.1);
  const ctaReveal      = useInView(0.2);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  /* Parallax helpers */
  const px = (rate: number) => `translateY(${scrollY * rate}px)`;

  return (
    <ScrollPathProvider>
    <div ref={pageRef} className="min-h-screen flex flex-col relative" style={{ background: "#0a0812" }}>
      {/* Cinematic scroll path — must be first child so it sits beneath all content */}
      <ScrollPathSystem containerRef={pageRef} />

      {/* ══════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          borderBottom: scrolled ? "1px solid #E5E8EE" : "1px solid rgba(255,255,255,0.06)",
          background: scrolled ? "rgba(255,248,242,0.95)" : "rgba(10,8,18,0.5)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "#FF6B1F", boxShadow: "0 0 16px rgba(255,107,31,0.4)" }}
            >
              <span className="text-white font-extrabold text-sm" style={{ fontFamily: "var(--font-jakarta)" }}>S</span>
            </div>
            <div className="flex flex-col leading-none">
              <span
                className="font-bold text-sm transition-colors duration-300"
                style={{ fontFamily: "var(--font-jakarta)", color: scrolled ? "#0F1115" : "#ffffff" }}
              >
                Super Sheldon
              </span>
              <span
                className="text-[10px] font-medium tracking-wide transition-colors duration-300"
                style={{ color: scrolled ? "#8A91A1" : "rgba(255,255,255,0.35)" }}
              >
                PTM Agent
              </span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="nav-link-animated text-sm font-medium transition-colors"
                style={{ color: scrolled ? "#5B6271" : "rgba(255,255,255,0.5)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = scrolled ? "#0F1115" : "rgba(255,255,255,0.9)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = scrolled ? "#5B6271" : "rgba(255,255,255,0.5)")}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <Link
            href="/ptm"
            className="btn-cta flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: "#FF6B1F", color: "white", fontFamily: "var(--font-jakarta)", boxShadow: "0 0 20px rgba(255,107,31,0.35)" }}
          >
            Open App <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* ══════════════════════════════════════
            HERO
        ══════════════════════════════════════ */}
        <section
          className="relative overflow-hidden"
          style={{ minHeight: "70vh", background: "linear-gradient(160deg, #0a0812 0%, #150d2a 45%, #1f0d00 100%)" }}
        >
          {/* Background glows — each at its own parallax rate */}
          <div className="pointer-events-none absolute inset-0">
            {/* Orb 1 — top-right orange */}
            <div style={{
              position: "absolute", top: "-15%", right: "-8%", width: 800, height: 800,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,107,31,0.22) 0%, transparent 65%)",
              filter: "blur(60px)",
              transform: px(-0.14),
              willChange: "transform",
            }} />
            {/* Orb 2 — top-left purple */}
            <div style={{
              position: "absolute", top: "5%", left: "-12%", width: 600, height: 600,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(120,60,220,0.18) 0%, transparent 65%)",
              filter: "blur(70px)",
              transform: px(-0.09),
              willChange: "transform",
            }} />
            {/* Orb 3 — bottom-center */}
            <div style={{
              position: "absolute", bottom: 0, left: "30%", width: 700, height: 400,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,107,31,0.08) 0%, transparent 65%)",
              filter: "blur(80px)",
              transform: px(-0.2),
              willChange: "transform",
            }} />
            {/* Perspective grid — parallax pulls it down, creating depth */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: "50%",
              backgroundImage: "linear-gradient(rgba(255,107,31,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,31,0.12) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              transform: `perspective(500px) rotateX(58deg) translateY(${scrollY * 0.28}px)`,
              transformOrigin: "50% 100%",
              maskImage: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
              willChange: "transform",
            }} />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-6 pt-8 lg:pt-10 pb-0">
            <div className="flex flex-col lg:flex-row items-start gap-12">

              {/* Left — text, subtle downward parallax (appears to lag behind scroll) */}
              <div
                className="flex-1 text-center lg:text-left"
                style={{ transform: px(0.07), willChange: "transform" }}
              >
                {/* Badge with continuous glow pulse */}
                <div
                  className="hero-badge inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide mb-6"
                  style={{ background: "rgba(255,107,31,0.1)", border: "1px solid rgba(255,107,31,0.25)", color: "rgba(255,160,80,0.95)" }}
                >
                  <Sparkles size={11} /> Powered by Azure OpenAI GPT-5.1
                </div>

                <h1
                  className="text-5xl md:text-6xl font-extrabold leading-tight mb-6"
                  style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.04em", color: "#ffffff" }}
                >
                  PTM reports,
                  <br />
                  <span style={{ background: "linear-gradient(90deg, #FF6B1F, #ff9f5a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    written by AI.
                  </span>
                  <br />
                  <span style={{ color: "rgba(255,255,255,0.75)" }}>Approved in one click.</span>
                </h1>

                <p className="text-lg leading-relaxed mb-8 max-w-lg" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Select sessions, fill a quick form, and get a detailed 3-page parent report in under 30 seconds. Teachers review and approve — parents receive it by email instantly.
                </p>

                <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 mb-10">
                  <Link
                    href="/ptm"
                    className="btn-cta flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-base"
                    style={{ background: "#FF6B1F", color: "white", fontFamily: "var(--font-jakarta)", boxShadow: "0 0 40px rgba(255,107,31,0.4)" }}
                  >
                    Generate your first report <ArrowRight size={16} />
                  </Link>
                  <a
                    href="#how-it-works"
                    className="flex items-center gap-1.5 px-5 py-3.5 rounded-full font-medium text-sm"
                    style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}
                  >
                    See how it works <ChevronDown size={14} />
                  </a>
                </div>

                {/* Social proof */}
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {["AR", "PS", "AK", "NK"].map((i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: "rgba(255,107,31,0.6)", border: "2px solid rgba(10,8,18,0.8)" }}
                      >
                        {i}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>65+ teachers</span> already using this
                  </p>
                </div>
              </div>

              {/* Right — mockup, counter-parallax floats upward */}
              <div
                className="flex-1 w-full max-w-lg lg:max-w-none relative pb-0"
                style={{ transform: px(-0.05), willChange: "transform" }}
              >
                <ProductMockup />
              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            STAT STRIP
        ══════════════════════════════════════ */}
        <section
          ref={statsReveal.ref}
          style={{
            background: "#ffffff",
            borderTop: "1px solid #E5E8EE",
            borderBottom: "1px solid #E5E8EE",
            opacity: statsReveal.inView ? 1 : 0,
            transform: statsReveal.inView ? "translateY(0)" : "translateY(40px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          <div className="max-w-6xl mx-auto px-6 py-10" style={{ position: "relative", zIndex: 11 }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {STATS.map((s) => (
                <StatItem key={s.label} stat={s} active={statsReveal.inView} />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            HOW IT WORKS
        ══════════════════════════════════════ */}
        <section id="how-it-works" style={{ background: "#FFF8F2", padding: "100px 0" }}>
          <div className="max-w-6xl mx-auto px-6" style={{ position: "relative", zIndex: 11 }}>

            {/* Section header — its own reveal */}
            <div
              ref={stepsReveal.ref}
              className="text-center mb-16"
              style={{
                opacity: stepsReveal.inView ? 1 : 0,
                transform: stepsReveal.inView ? "translateY(0)" : "translateY(32px)",
                transition: "opacity 0.6s ease, transform 0.6s ease",
              }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#FF6B1F" }}>How it works</p>
              <h2
                className="text-4xl md:text-5xl font-extrabold"
                style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em", color: "#0F1115" }}
              >
                From sessions to parents
                <br />
                <span style={{ color: "#8A91A1" }}>in three steps.</span>
              </h2>
            </div>

            <div className="relative">
              <div
                className="hidden lg:block absolute top-10 left-0 right-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent 8%, rgba(255,107,31,0.3) 20%, rgba(255,107,31,0.3) 80%, transparent 92%)" }}
              />
              <div className="grid lg:grid-cols-3 gap-6">
                {STEPS.map((step, i) => (
                  <StepCard key={step.number} step={step} index={i} inView={stepsReveal.inView} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            BENTO FEATURES
        ══════════════════════════════════════ */}
        <section id="features" style={{ background: "#ffffff", padding: "100px 0", borderTop: "1px solid #E5E8EE" }}>
          <div className="max-w-6xl mx-auto px-6" style={{ position: "relative", zIndex: 11 }}>

            <div
              ref={featReveal.ref}
              className="text-center mb-16"
              style={{
                opacity: featReveal.inView ? 1 : 0,
                transform: featReveal.inView ? "translateY(0)" : "translateY(32px)",
                transition: "opacity 0.6s ease, transform 0.6s ease",
              }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#FF6B1F" }}>Features</p>
              <h2
                className="text-4xl md:text-5xl font-extrabold"
                style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em", color: "#0F1115" }}
              >
                Built for teachers.
                <br />
                <span style={{ color: "#8A91A1" }}>Trusted by parents.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Large card */}
              <div
                className="lg:col-span-2 rounded-3xl p-8 relative overflow-hidden feat-large-card"
                style={{
                  background: "linear-gradient(135deg, #FFF1E6 0%, #FFF8F2 100%)",
                  border: "1px solid #FFE0C7",
                  opacity: featReveal.inView ? 1 : 0,
                  transform: featReveal.inView ? "translateY(0)" : "translateY(48px)",
                  transition: "opacity 0.55s ease 0s, transform 0.55s cubic-bezier(0.34,1.56,0.64,1) 0s, box-shadow 0.3s ease",
                }}
              >
                <div
                  className="absolute top-0 right-0 w-64 h-64 rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(255,107,31,0.08) 0%, transparent 70%)", transform: "translate(30%, -30%)" }}
                />
                <span
                  className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4"
                  style={{ background: "#FFF1E6", color: "#E85A12", border: "1px solid #FFE0C7" }}
                >
                  AI-powered
                </span>
                <Bot
                  size={28}
                  className="mb-4"
                  style={{ color: "#FF6B1F", display: "block" }}
                />
                <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "var(--font-jakarta)", color: "#0F1115" }}>
                  Reports that actually sound human
                </h3>
                <p className="text-sm leading-relaxed max-w-md" style={{ color: "#5B6271" }}>
                  Azure OpenAI GPT-5.1 reads session transcripts and teacher notes, then writes warm, specific reports — strengths, confidence trend, milestones, parent action items, recommended resources. Up to 3 full pages of real insight, not filler.
                </p>
                <div
                  className="mt-6 rounded-xl p-4"
                  style={{ background: "#ffffff", border: "1px solid #E5E8EE", boxShadow: "0 4px 12px rgba(15,17,21,0.06)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#FF6B1F" }} />
                    <span className="text-xs font-semibold" style={{ color: "#0F1115" }}>Milestone of the Month</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "#8A91A1" }}>
                    &ldquo;This period, Arjun achieved a notable milestone by solving a complete quadratic equation independently for the first time — without any prompting...&rdquo;
                  </p>
                </div>
              </div>

              {/* Small cards */}
              {FEATURES.filter((f) => f.size === "small").map((feat, i) => (
                <SmallFeatureCard key={feat.title} feat={feat} index={i} inView={featReveal.inView} />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            TESTIMONIALS
        ══════════════════════════════════════ */}
        <section style={{ background: "#FFF8F2", padding: "100px 0", borderTop: "1px solid #E5E8EE" }}>
          <div className="max-w-6xl mx-auto px-6" style={{ position: "relative", zIndex: 11 }}>

            <div
              ref={testReveal.ref}
              className="text-center mb-16"
              style={{
                opacity: testReveal.inView ? 1 : 0,
                transform: testReveal.inView ? "translateY(0)" : "translateY(32px)",
                transition: "opacity 0.6s ease, transform 0.6s ease",
              }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#FF6B1F" }}>From teachers</p>
              <h2
                className="text-4xl font-extrabold"
                style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em", color: "#0F1115" }}
              >
                What the team is saying
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {TESTIMONIALS.map((t, i) => (
                <TestimonialCard key={t.name} t={t} index={i} inView={testReveal.inView} />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            FAQ
        ══════════════════════════════════════ */}
        <section id="faq" style={{ background: "#ffffff", padding: "100px 0", borderTop: "1px solid #E5E8EE" }}>
          <div className="max-w-3xl mx-auto px-6" style={{ position: "relative", zIndex: 11 }}>

            <div
              ref={faqReveal.ref}
              className="text-center mb-16"
              style={{
                opacity: faqReveal.inView ? 1 : 0,
                transform: faqReveal.inView ? "translateY(0)" : "translateY(32px)",
                transition: "opacity 0.6s ease, transform 0.6s ease",
              }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#FF6B1F" }}>FAQ</p>
              <h2
                className="text-4xl font-extrabold"
                style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em", color: "#0F1115" }}
              >
                Questions? Answered.
              </h2>
            </div>

            <FAQAccordion items={FAQS} inView={faqReveal.inView} />
          </div>
        </section>

        {/* ══════════════════════════════════════
            FINAL CTA
        ══════════════════════════════════════ */}
        <section style={{ background: "#FFF8F2", padding: "80px 24px", borderTop: "1px solid #E5E8EE" }}>
          <div
            ref={ctaReveal.ref}
            className="max-w-4xl mx-auto rounded-3xl px-10 py-16 text-center relative overflow-hidden"
            style={{
              position: "relative",
              zIndex: 11,
              background: "linear-gradient(135deg, #FF6B1F 0%, #ff8f45 100%)",
              boxShadow: "0 20px 60px rgba(255,107,31,0.35)",
              opacity: ctaReveal.inView ? 1 : 0,
              transform: ctaReveal.inView ? "translateY(0) scale(1)" : "translateY(40px) scale(0.97)",
              transition: "opacity 0.7s ease, transform 0.7s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div style={{
                position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)",
                width: 600, height: 300, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 65%)",
                filter: "blur(40px)",
              }} />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: "rgba(255,255,255,0.7)" }}>
                Get started
              </p>
              <h2
                className="text-4xl md:text-5xl font-extrabold text-white mb-4"
                style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}
              >
                Ready to generate
                <br />your first report?
              </h2>
              <p className="text-base mb-8" style={{ color: "rgba(255,255,255,0.75)" }}>
                Pick a teacher, select sessions, and have a full report ready in under a minute.
              </p>
              <Link
                href="/ptm"
                className="btn-cta inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base"
                style={{ background: "#ffffff", color: "#FF6B1F", fontFamily: "var(--font-jakarta)", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}
              >
                Open the App <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer style={{ background: "#ffffff", borderTop: "1px solid #E5E8EE", padding: "40px 24px" }}>
        <div className="max-w-6xl mx-auto" style={{ position: "relative", zIndex: 11 }}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#FF6B1F" }}>
                <span className="text-white font-extrabold text-[11px]">S</span>
              </div>
              <span className="font-bold text-sm" style={{ fontFamily: "var(--font-jakarta)", color: "#0F1115" }}>Super Sheldon</span>
            </div>
            <div className="flex items-center gap-6">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="nav-link-animated text-xs transition-colors"
                  style={{ color: "#8A91A1" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#0F1115")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#8A91A1")}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6"
            style={{ borderTop: "1px solid #E5E8EE" }}
          >
            <span className="text-xs" style={{ color: "#C4C9D2" }}>© 2026 Sheldon Labs. All rights reserved.</span>
            <span className="text-xs" style={{ color: "#C4C9D2" }}>Powered by Azure OpenAI GPT-5.1 · Built at Sheldon Labs</span>
          </div>
        </div>
      </footer>

    </div>
    </ScrollPathProvider>
  );
}

/* ─────────────────────────────────────────────
   PRODUCT MOCKUP
───────────────────────────────────────────── */
function ProductMockup() {
  return (
    <div className="relative" style={{ perspective: "1200px" }}>
      <div style={{
        position: "absolute", inset: "-20%",
        background: "radial-gradient(circle, rgba(255,107,31,0.15) 0%, transparent 65%)",
        filter: "blur(30px)",
        pointerEvents: "none",
      }} />

      {/* Browser chrome */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "#1a1625",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
          transform: "rotateY(-6deg) rotateX(3deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Browser top bar */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#120f1e", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: "#ff5f56" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#ffbd2e" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#27c93f" }} />
          </div>
          <div className="flex-1 mx-3 px-3 py-1 rounded-md text-[10px] text-center" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>
            ptm.supersheldon.com/ptm
          </div>
        </div>

        {/* App UI */}
        <div className="p-5" style={{ background: "#FFF8F2" }}>
          <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: "1px solid #E5E8EE" }}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#FF6B1F" }}>
                <span className="text-white font-bold text-[8px]">S</span>
              </div>
              <span className="text-[10px] font-bold" style={{ color: "#0F1115" }}>Super Sheldon</span>
            </div>
            <div className="flex gap-3">
              {["Generate", "Pending", "Escalated"].map((l) => (
                <span key={l} className="text-[9px] font-medium" style={{ color: l === "Pending" ? "#FF6B1F" : "#8A91A1" }}>{l}</span>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-4 mb-3" style={{ background: "white", border: "1px solid #E5E8EE" }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-xs font-bold mb-0.5" style={{ color: "#0F1115" }}>Arjun Mehta</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "#F2F4F7", color: "#5B6271" }}>Maths</span>
                  <span className="text-[9px]" style={{ color: "#8A91A1" }}>· Ms. Ankita Rathi</span>
                </div>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "#FFF1E6", color: "#E85A12", border: "1px solid #FFE0C7" }}>Pending</span>
            </div>
            <div className="space-y-1.5">
              {[["Attendance", 88], ["Confidence", 72], ["Engagement", 95]].map(([label, pct]) => (
                <div key={String(label)}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[8px]" style={{ color: "#8A91A1" }}>{label}</span>
                    <span className="text-[8px] font-semibold" style={{ color: "#0F1115" }}>{pct}%</span>
                  </div>
                  <div className="h-1 rounded-full" style={{ background: "#F2F4F7" }}>
                    <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #FF6B1F, #ff9f5a)" }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <div className="flex-1 py-1.5 rounded-full text-center text-[9px] font-bold text-white" style={{ background: "#FF6B1F" }}>Approve</div>
              <div className="flex-1 py-1.5 rounded-full text-center text-[9px] font-semibold" style={{ background: "#F2F4F7", color: "#5B6271" }}>Review</div>
            </div>
          </div>

          <div className="rounded-xl p-3 opacity-50" style={{ background: "white", border: "1px solid #E5E8EE" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold" style={{ color: "#0F1115" }}>Sneha Iyer</div>
                <span className="text-[9px]" style={{ color: "#8A91A1" }}>English · 3 sessions selected</span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "#f0fdf4", color: "#16A34A", border: "1px solid #bbf7d0" }}>Approved</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge — gentle bob animation */}
      <div
        className="badge-float absolute -bottom-4 -left-4 rounded-2xl px-4 py-3"
        style={{
          background: "rgba(26,22,37,0.9)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(22,163,74,0.15)" }}>
            <CheckCircle2 size={13} style={{ color: "#16A34A" }} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-white">Delivered</div>
            <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>Email · just now</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FAQ ACCORDION
───────────────────────────────────────────── */
function FAQAccordion({ items, inView }: { items: typeof FAQS; inView: boolean }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="rounded-2xl overflow-hidden"
            style={{
              border: `1px solid ${isOpen ? "#FFE0C7" : "#E5E8EE"}`,
              background: isOpen ? "#FFF8F2" : "#ffffff",
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(24px)",
              transition: `opacity 0.5s ease ${i * 0.08}s, transform 0.5s ease ${i * 0.08}s, border-color 0.25s ease, background 0.25s ease`,
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between px-6 py-5 text-left"
            >
              <span className="text-sm font-semibold pr-4" style={{ color: "#0F1115" }}>{item.q}</span>
              <span style={{
                color: isOpen ? "#FF6B1F" : "#C4C9D2",
                flexShrink: 0,
                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.3s ease, color 0.2s ease",
                display: "inline-flex",
              }}>
                <ChevronDown size={16} />
              </span>
            </button>
            <div style={{
              maxHeight: isOpen ? "200px" : "0",
              overflow: "hidden",
              transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            }}>
              <p className="px-6 pb-5 text-sm leading-relaxed" style={{ color: "#5B6271" }}>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
