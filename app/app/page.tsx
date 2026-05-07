import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, ChevronDown, RefreshCw, Sparkles, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FFFFFF" }}>
      {/* ── Landing Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-[var(--ss-i-200)] bg-white/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center shadow-[var(--ss-shadow-brand)]">
              <span className="text-white font-bold text-sm" style={{ fontFamily: "var(--font-jakarta)" }}>S</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-[var(--ss-i-900)] text-sm" style={{ fontFamily: "var(--font-jakarta)" }}>Super Sheldon</span>
              <span className="text-[10px] text-[var(--ss-i-400)] font-medium tracking-wide">PTM Agent</span>
            </div>
          </div>
          <Link
            href="/ptm"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--ss-o-500)] text-white text-sm font-semibold hover:bg-[var(--ss-o-600)] transition-colors shadow-[var(--ss-shadow-brand)]"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            Open App
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--ss-o-50)] border border-[var(--ss-o-200)] text-[var(--ss-o-700)] text-xs font-semibold tracking-wide mb-8">
            <Sparkles size={12} className="text-[var(--ss-o-500)]" />
            PTM Reports · Automated
          </div>

          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-[var(--ss-i-900)] mb-6 leading-tight"
            style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}
          >
            AI-written reports.
            <br />
            <span className="text-[var(--ss-o-500)]">Approved by teachers.</span>
            <br />
            Delivered to parents.
          </h1>

          <p className="text-lg text-[var(--ss-i-500)] max-w-2xl mx-auto mb-10 leading-relaxed">
            Replace the 8-page manual PTM template with a focused 1-page AI-generated report.
            The teacher reviews and approves, then the report is delivered to parents automatically
            via email and WhatsApp — all in under a minute.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/ptm"
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--ss-o-500)] text-white font-semibold hover:bg-[var(--ss-o-600)] transition-all shadow-[var(--ss-shadow-brand)] hover:shadow-lg text-base"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Open the App
              <ArrowRight size={16} />
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-1.5 text-[var(--ss-i-500)] hover:text-[var(--ss-i-700)] text-sm font-medium transition-colors"
            >
              See how it works
              <ChevronDown size={15} />
            </a>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--ss-i-400)]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ss-o-400)]" />
              5 active students
            </span>
            <span className="text-[var(--ss-i-300)]">·</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ss-o-400)]" />
              2 teachers
            </span>
            <span className="text-[var(--ss-i-300)]">·</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ss-o-400)]" />
              ~30 sec per report
            </span>
            <span className="text-[var(--ss-i-300)]">·</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ss-o-400)]" />
              Runs on the 1st of every month
            </span>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="border-t border-[var(--ss-i-200)] bg-[var(--ss-bg)] py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ss-o-600)] mb-3">How it works</p>
              <h2
                className="text-3xl md:text-4xl font-bold text-[var(--ss-i-900)]"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                Three steps, zero manual effort
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {STEPS.map((step) => (
                <div key={step.number} className="bg-white rounded-2xl p-7 shadow-[var(--ss-shadow)] border border-[var(--ss-i-200)] relative">
                  <div className="w-10 h-10 rounded-full bg-[var(--ss-o-50)] border border-[var(--ss-o-200)] flex items-center justify-center mb-5">
                    <step.Icon size={18} className="text-[var(--ss-o-500)]" />
                  </div>
                  <div className="text-xs font-bold text-[var(--ss-o-500)] mb-1 tracking-widest uppercase">Step {step.number}</div>
                  <h3
                    className="text-lg font-bold text-[var(--ss-i-900)] mb-2"
                    style={{ fontFamily: "var(--font-jakarta)" }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-sm text-[var(--ss-i-500)] leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="border-t border-[var(--ss-i-200)] bg-white py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ss-o-600)] mb-3">Features</p>
              <h2
                className="text-3xl md:text-4xl font-bold text-[var(--ss-i-900)]"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                Built for teachers, not engineers
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {FEATURES.map((feat) => (
                <div key={feat.title} className="bg-[var(--ss-bg)] rounded-2xl p-7 border border-[var(--ss-i-200)]">
                  <div className="w-9 h-9 rounded-xl bg-[var(--ss-o-500)] flex items-center justify-center mb-5 shadow-[var(--ss-shadow-brand)]">
                    <feat.Icon size={16} className="text-white" />
                  </div>
                  <h3
                    className="text-base font-bold text-[var(--ss-i-900)] mb-2"
                    style={{ fontFamily: "var(--font-jakarta)" }}
                  >
                    {feat.title}
                  </h3>
                  <p className="text-sm text-[var(--ss-i-500)] leading-relaxed">{feat.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="border-t border-[var(--ss-i-200)] bg-[var(--ss-o-500)] py-16">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2
              className="text-2xl md:text-3xl font-bold text-white mb-4"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Ready to review this month's reports?
            </h2>
            <p className="text-white/80 text-sm mb-8">
              5 reports are waiting for your approval.
            </p>
            <Link
              href="/ptm"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[var(--ss-o-600)] font-semibold hover:bg-[var(--ss-o-50)] transition-colors text-base"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Open the Approval Queue
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--ss-i-200)] bg-white py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--ss-i-400)]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center">
              <span className="text-white font-bold text-[9px]">S</span>
            </div>
            <span>© 2026 Sheldon Labs</span>
          </div>
          <span>Powered by Claude · Anthropic</span>
        </div>
      </footer>
    </div>
  );
}

const STEPS = [
  {
    number: 1,
    Icon: Zap,
    title: "Agent pulls class data",
    description: "On the 1st of every month at 06:00 IST, the agent automatically fetches class summaries, attendance records, and session notes from the Wise portal.",
  },
  {
    number: 2,
    Icon: Bot,
    title: "Claude generates the draft",
    description: "Claude writes a concise, parent-friendly 1-page report in seconds. Any section that required inference is clearly flagged for the teacher to verify.",
  },
  {
    number: 3,
    Icon: CheckCircle2,
    title: "Teacher approves, parents receive",
    description: "The draft lands in the teacher's approval queue. One click to approve — then the report is delivered to parents automatically via email and WhatsApp.",
  },
];

const FEATURES = [
  {
    Icon: Bot,
    title: "AI-generated, teacher-verified",
    description: "Claude writes every report. Teachers review, add a personal note, and approve — maintaining quality and trust without the manual effort.",
  },
  {
    Icon: Sparkles,
    title: "Smart inference flags",
    description: "When data is sparse, Claude makes conservative assumptions and clearly marks those sections in orange so teachers know exactly what to verify.",
  },
  {
    Icon: RefreshCw,
    title: "2-cycle regeneration",
    description: "If a report needs changes, teachers answer a short questionnaire and Claude regenerates. After 2 cycles, the report escalates to a manager automatically.",
  },
];
