"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight, Sparkles, Zap, CheckCircle2, RefreshCw, Bot,
  Shield, Clock, Send, ChevronDown, ChevronUp, Star,
} from "lucide-react";

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
];

const STATS = [
  { value: "500+", label: "Reports generated", sub: "across April 2026" },
  { value: "65+", label: "Active teachers", sub: "using the platform" },
  { value: "<30s", label: "Per report", sub: "from sessions to draft" },
];

const STEPS = [
  {
    number: "01",
    Icon: Zap,
    title: "Pick sessions & fill the form",
    description:
      "Choose a teacher, select a student, then pick up to 4 past sessions. Fill in the quick teacher assessment — engagement, highlights, goals — and hit Generate.",
  },
  {
    number: "02",
    Icon: Bot,
    title: "AI writes the full report",
    description:
      "Gemini 2.5 Flash reads the session transcripts and your notes, then writes a detailed, parent-friendly report — strengths, milestones, action items, and more. Done in seconds.",
  },
  {
    number: "03",
    Icon: CheckCircle2,
    title: "Teacher approves, parents receive",
    description:
      "The draft lands in the approval queue. One click to approve and add a personal note — then it's delivered to parents automatically via email and WhatsApp.",
  },
];

const FEATURES = [
  {
    size: "large",
    Icon: Bot,
    tag: "AI-powered",
    title: "Reports that actually sound human",
    description:
      "Gemini 2.5 Flash writes every section in warm, parent-friendly language — no jargon, no boilerplate. Strengths, milestones, confidence trend, homework effort, recommended resources and more. Up to 3 pages of real insight.",
    accent: true,
  },
  {
    size: "small",
    Icon: Shield,
    tag: "Quality control",
    title: "Inferred sections are clearly flagged",
    description:
      "Any section the AI had to guess is highlighted in amber so teachers know exactly what to verify before approving.",
  },
  {
    size: "small",
    Icon: RefreshCw,
    tag: "Feedback loop",
    title: "2-cycle regeneration",
    description:
      "Teachers reject → answer a short questionnaire → AI regenerates with corrections. After 2 cycles, it auto-escalates to a manager.",
  },
  {
    size: "small",
    Icon: Send,
    tag: "Delivery",
    title: "Email + WhatsApp in one click",
    description:
      "Approve the report and it goes straight to parents. No copy-paste, no attachments, no manual sending.",
  },
  {
    size: "small",
    Icon: Clock,
    tag: "Efficiency",
    title: "8 pages → 1 approval click",
    description:
      "Replaced a 8–9 page manual PTM template. Teachers go from draft to delivered in under a minute.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "I used to spend 45 minutes per student writing reports. Now I review, add a line, and approve. The AI picks up things I would have missed — like noting that Alara asked especially good questions this month.",
    name: "Ankita R.",
    role: "Maths Teacher · Sheldon Labs",
    initials: "AR",
  },
  {
    quote:
      "Parents love the new format. It's specific, warm, and actually tells them what to do at home. One parent told me it was the most useful school communication she'd ever received.",
    name: "Preksha S.",
    role: "English Teacher · Sheldon Labs",
    initials: "PS",
  },
];

const FAQS = [
  {
    q: "How does the AI know what to write?",
    a: "It reads the session transcripts from your Wise sessions — the actual notes from each class — plus the teacher assessment form you fill in. The more detail you give, the richer the report.",
  },
  {
    q: "What if the AI gets something wrong?",
    a: "Inferred sections are highlighted so teachers know what to verify. If anything is off, reject the report, fill in a short questionnaire, and it regenerates with your corrections baked in.",
  },
  {
    q: "How many sessions should I select per report?",
    a: "You can select up to 4 sessions. We recommend picking the most recent 3–4 so the report reflects current progress rather than older material.",
  },
  {
    q: "Where is the data stored?",
    a: "Session transcripts stay in your existing MongoDB database. Generated reports are stored in a local SQLite database. Nothing leaves your infrastructure.",
  },
  {
    q: "Can teachers add their own note to the report?",
    a: "Yes — there's a personal note field in the approval modal. It appears as a highlighted section in the final report that parents receive.",
  },
];

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0812" }}>

      {/* ══════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,8,18,0.5)",
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
              <span className="font-bold text-sm text-white" style={{ fontFamily: "var(--font-jakarta)" }}>Super Sheldon</span>
              <span className="text-[10px] font-medium tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>PTM Agent</span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium transition-colors"
                style={{ color: "rgba(255,255,255,0.5)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <Link
            href="/ptm"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold"
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
        <section className="relative overflow-hidden" style={{ minHeight: "90vh", background: "linear-gradient(160deg, #0a0812 0%, #150d2a 45%, #1f0d00 100%)" }}>

          {/* Background glows */}
          <div className="pointer-events-none absolute inset-0">
            <div style={{ position: "absolute", top: "-15%", right: "-8%", width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,31,0.22) 0%, transparent 65%)", filter: "blur(60px)" }} />
            <div style={{ position: "absolute", top: "5%", left: "-12%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(120,60,220,0.18) 0%, transparent 65%)", filter: "blur(70px)" }} />
            <div style={{ position: "absolute", bottom: "0", left: "30%", width: 700, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,31,0.08) 0%, transparent 65%)", filter: "blur(80px)" }} />
            {/* Perspective grid */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: "50%",
              backgroundImage: "linear-gradient(rgba(255,107,31,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,31,0.12) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              transform: "perspective(500px) rotateX(58deg)",
              transformOrigin: "50% 100%",
              maskImage: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
            }} />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-0">
            <div className="flex flex-col lg:flex-row items-center gap-16">

              {/* Left — text */}
              <div className="flex-1 text-center lg:text-left">
                {/* Badge */}
                <div
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide mb-6"
                  style={{ background: "rgba(255,107,31,0.1)", border: "1px solid rgba(255,107,31,0.25)", color: "rgba(255,160,80,0.95)" }}
                >
                  <Sparkles size={11} /> Powered by Gemini 2.5 Flash
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
                  Select sessions, fill a quick form, and get a detailed 3-page parent report in under 30 seconds. Teachers review and approve — parents receive it via email and WhatsApp instantly.
                </p>

                <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 mb-10">
                  <Link
                    href="/ptm"
                    className="flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-base"
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

                {/* Mini social proof */}
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {["AR", "PS", "AK", "NK"].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "rgba(255,107,31,0.6)", border: "2px solid rgba(10,8,18,0.8)" }}>{i}</div>
                    ))}
                  </div>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>65+ teachers</span> already using this
                  </p>
                </div>
              </div>

              {/* Right — product mockup */}
              <div className="flex-1 w-full max-w-lg lg:max-w-none relative pb-0">
                <ProductMockup />
              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            STAT STRIP
        ══════════════════════════════════════ */}
        <section style={{ background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="max-w-6xl mx-auto px-6 py-10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-4xl font-extrabold mb-1" style={{ fontFamily: "var(--font-jakarta)", background: "linear-gradient(90deg, #FF6B1F, #ff9f5a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {s.value}
                  </div>
                  <div className="text-sm font-semibold text-white mb-0.5">{s.label}</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            HOW IT WORKS
        ══════════════════════════════════════ */}
        <section id="how-it-works" style={{ background: "#0a0812", padding: "100px 0" }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#FF6B1F" }}>How it works</p>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white" style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}>
                From sessions to parents
                <br />
                <span style={{ color: "rgba(255,255,255,0.4)" }}>in three steps.</span>
              </h2>
            </div>

            <div className="relative">
              {/* Connector line desktop */}
              <div className="hidden lg:block absolute top-10 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent 8%, rgba(255,107,31,0.3) 20%, rgba(255,107,31,0.3) 80%, transparent 92%)" }} />

              <div className="grid lg:grid-cols-3 gap-6">
                {STEPS.map((step, i) => (
                  <div
                    key={step.number}
                    className="relative rounded-2xl p-8"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {/* Step number bubble */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-6 relative z-10" style={{ background: i === 1 ? "#FF6B1F" : "rgba(255,107,31,0.12)", color: i === 1 ? "white" : "#FF6B1F", border: i === 1 ? "none" : "1px solid rgba(255,107,31,0.3)", fontFamily: "var(--font-jakarta)" }}>
                      {step.number}
                    </div>
                    <step.Icon size={20} className="mb-4" style={{ color: "#FF6B1F" }} />
                    <h3 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-jakarta)" }}>{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            BENTO FEATURES
        ══════════════════════════════════════ */}
        <section id="features" style={{ background: "#0d0b1a", padding: "100px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#FF6B1F" }}>Features</p>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white" style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}>
                Built for teachers.
                <br />
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Trusted by parents.</span>
              </h2>
            </div>

            {/* Bento grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Large card — spans 2 cols */}
              <div
                className="lg:col-span-2 rounded-3xl p-8 relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, rgba(255,107,31,0.15) 0%, rgba(255,107,31,0.04) 100%)", border: "1px solid rgba(255,107,31,0.2)" }}
              >
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,107,31,0.12) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4" style={{ background: "rgba(255,107,31,0.15)", color: "#FF8526", border: "1px solid rgba(255,107,31,0.25)" }}>AI-powered</span>
                <Bot size={28} className="mb-4" style={{ color: "#FF6B1F" }} />
                <h3 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-jakarta)" }}>Reports that actually sound human</h3>
                <p className="text-sm leading-relaxed max-w-md" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Gemini 2.5 Flash reads session transcripts and teacher notes, then writes warm, specific reports — strengths, confidence trend, milestones, parent action items, recommended resources. Up to 3 full pages of real insight, not filler.
                </p>
                {/* Mini report preview */}
                <div className="mt-6 rounded-xl p-4" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#FF6B1F" }} />
                    <span className="text-xs font-semibold text-white">Milestone of the Month</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                    &ldquo;This period, Arjun achieved a notable milestone by solving a complete quadratic equation independently for the first time — without any prompting...&rdquo;
                  </p>
                </div>
              </div>

              {/* Small cards */}
              {FEATURES.filter((f) => f.size === "small").map((feat) => (
                <div
                  key={feat.title}
                  className="rounded-3xl p-7"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{feat.tag}</span>
                  <feat.Icon size={22} className="mb-4" style={{ color: "#FF6B1F" }} />
                  <h3 className="text-base font-bold text-white mb-2" style={{ fontFamily: "var(--font-jakarta)" }}>{feat.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{feat.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            TESTIMONIALS
        ══════════════════════════════════════ */}
        <section style={{ background: "#0a0812", padding: "100px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#FF6B1F" }}>From teachers</p>
              <h2 className="text-4xl font-extrabold text-white" style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}>
                What the team is saying
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="rounded-3xl p-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex gap-1 mb-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} fill="#FF6B1F" className="text-[#FF6B1F]" />
                    ))}
                  </div>
                  <p className="text-base leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.65)" }}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "rgba(255,107,31,0.5)" }}>{t.initials}</div>
                    <div>
                      <div className="text-sm font-semibold text-white">{t.name}</div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            FAQ
        ══════════════════════════════════════ */}
        <section id="faq" style={{ background: "#0d0b1a", padding: "100px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#FF6B1F" }}>FAQ</p>
              <h2 className="text-4xl font-extrabold text-white" style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}>
                Questions? Answered.
              </h2>
            </div>
            <FAQAccordion items={FAQS} />
          </div>
        </section>

        {/* ══════════════════════════════════════
            FINAL CTA
        ══════════════════════════════════════ */}
        <section style={{ background: "#0a0812", padding: "80px 24px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div
            className="max-w-4xl mx-auto rounded-3xl px-10 py-16 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #1a0a00 0%, #2d1100 50%, #1a0a00 100%)", border: "1px solid rgba(255,107,31,0.2)" }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div style={{ position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,31,0.18) 0%, transparent 65%)", filter: "blur(40px)" }} />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: "rgba(255,107,31,0.7)" }}>Get started</p>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}>
                Ready to generate
                <br />your first report?
              </h2>
              <p className="text-base mb-8" style={{ color: "rgba(255,255,255,0.45)" }}>
                Pick a teacher, select sessions, and have a full report ready in under a minute.
              </p>
              <Link
                href="/ptm"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base"
                style={{ background: "#FF6B1F", color: "white", fontFamily: "var(--font-jakarta)", boxShadow: "0 0 50px rgba(255,107,31,0.4)" }}
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
      <footer style={{ background: "#0a0812", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px 24px" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#FF6B1F" }}>
                <span className="text-white font-extrabold text-[11px]">S</span>
              </div>
              <span className="font-bold text-white text-sm" style={{ fontFamily: "var(--font-jakarta)" }}>Super Sheldon</span>
            </div>
            <div className="flex items-center gap-6">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="text-xs transition-colors" style={{ color: "rgba(255,255,255,0.35)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>© 2026 Sheldon Labs. All rights reserved.</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Powered by Gemini 2.5 Flash · Built at Sheldon Labs</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

/* ─────────────────────────────────────────────
   PRODUCT MOCKUP
───────────────────────────────────────────── */
function ProductMockup() {
  return (
    <div className="relative" style={{ perspective: "1200px" }}>
      {/* Glow behind */}
      <div style={{ position: "absolute", inset: "-20%", background: "radial-gradient(circle, rgba(255,107,31,0.15) 0%, transparent 65%)", filter: "blur(30px)", pointerEvents: "none" }} />

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
          {/* Mini navbar */}
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

          {/* Report card */}
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
            {/* Progress bars */}
            <div className="space-y-1.5">
              {[["Attendance", 88], ["Confidence", 72], ["Engagement", 95]].map(([label, pct]) => (
                <div key={label}>
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

          {/* Second card faded */}
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

      {/* Floating badge */}
      <div
        className="absolute -bottom-4 -left-4 rounded-2xl px-4 py-3"
        style={{ background: "rgba(26,22,37,0.9)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(22,163,74,0.15)" }}>
            <CheckCircle2 size={13} style={{ color: "#16A34A" }} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-white">Delivered</div>
            <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>Email + WhatsApp · just now</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FAQ ACCORDION
───────────────────────────────────────────── */
function FAQAccordion({ items }: { items: typeof FAQS }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${open === i ? "rgba(255,107,31,0.25)" : "rgba(255,255,255,0.07)"}`, background: open === i ? "rgba(255,107,31,0.05)" : "rgba(255,255,255,0.03)" }}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-6 py-5 text-left"
          >
            <span className="text-sm font-semibold text-white pr-4">{item.q}</span>
            {open === i
              ? <ChevronUp size={16} style={{ color: "#FF6B1F", flexShrink: 0 }} />
              : <ChevronDown size={16} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
            }
          </button>
          {open === i && (
            <div className="px-6 pb-5">
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
