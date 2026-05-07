import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, ChevronDown, RefreshCw, Sparkles, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0f0c1a" }}>
      {/* ── Landing Navbar ── */}
      <header className="sticky top-0 z-50" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(15,12,26,0.15)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center shadow-[var(--ss-shadow-brand)]">
              <span className="text-white font-bold text-sm" style={{ fontFamily: "var(--font-jakarta)" }}>S</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-sm" style={{ fontFamily: "var(--font-jakarta)", color: "white" }}>Super Sheldon</span>
              <span className="text-[10px] font-medium tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>PTM Agent</span>
            </div>
          </div>
          <Link
            href="/ptm"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
            style={{ background: "#FF6B1F", color: "white", fontFamily: "var(--font-jakarta)", boxShadow: "0 0 20px rgba(255,107,31,0.3)" }}
          >
            Open App
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0f0c1a 0%, #1a0f2e 40%, #2d1200 100%)", minHeight: "92vh" }}>

          {/* ── 3D background layer ── */}
          {/* Gradient orbs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* Big orange glow top-right */}
            <div style={{
              position: "absolute", top: "-10%", right: "-5%",
              width: 700, height: 700, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,107,31,0.35) 0%, rgba(255,107,31,0.08) 50%, transparent 70%)",
              filter: "blur(40px)",
            }} />
            {/* Purple glow left */}
            <div style={{
              position: "absolute", top: "10%", left: "-10%",
              width: 500, height: 500, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(120,60,200,0.25) 0%, transparent 65%)",
              filter: "blur(50px)",
            }} />
            {/* Warm mid glow */}
            <div style={{
              position: "absolute", top: "30%", left: "40%",
              width: 400, height: 400, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,150,50,0.12) 0%, transparent 65%)",
              filter: "blur(60px)",
            }} />

            {/* 3D perspective grid floor */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: "55%",
              backgroundImage: `
                linear-gradient(rgba(255,107,31,0.18) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,107,31,0.18) 1px, transparent 1px)
              `,
              backgroundSize: "60px 60px",
              transform: "perspective(600px) rotateX(55deg)",
              transformOrigin: "50% 100%",
              maskImage: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
            }} />

            {/* Floating 3D card 1 */}
            <div style={{
              position: "absolute", top: "15%", right: "8%",
              width: 180, padding: "14px 18px", borderRadius: 16,
              background: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
              transform: "rotate(4deg)",
            }}>
              <div style={{ fontSize: 10, color: "rgba(255,107,31,0.9)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>AI Generated</div>
              <div style={{ fontSize: 13, color: "white", fontWeight: 600, lineHeight: 1.4 }}>Arjun&apos;s Progress Report</div>
              <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.1)" }}>
                <div style={{ height: 4, width: "82%", borderRadius: 4, background: "linear-gradient(90deg, #FF6B1F, #ff9a56)" }} />
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Attendance 82%</div>
            </div>

            {/* Floating 3D card 2 */}
            <div style={{
              position: "absolute", top: "42%", right: "13%",
              width: 155, padding: "12px 16px", borderRadius: 14,
              background: "rgba(255,107,31,0.12)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,107,31,0.25)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
              transform: "rotate(-3deg)",
            }}>
              <div style={{ fontSize: 10, color: "rgba(255,107,31,0.8)", fontWeight: 700, marginBottom: 5 }}>✓ Approved</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>Delivered via email & WhatsApp</div>
            </div>

            {/* Floating dot cluster */}
            <svg style={{ position: "absolute", top: "8%", left: "5%", opacity: 0.25 }} width="120" height="120" viewBox="0 0 120 120">
              {Array.from({ length: 36 }, (_, i) => (
                <circle key={i} cx={(i % 6) * 22 + 5} cy={Math.floor(i / 6) * 22 + 5} r="2.5" fill="#FF6B1F" />
              ))}
            </svg>
          </div>

          {/* ── Hero text content ── */}
          <div className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-32 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold tracking-wide mb-8"
              style={{ background: "rgba(255,107,31,0.12)", borderColor: "rgba(255,107,31,0.3)", color: "rgba(255,150,80,0.95)" }}>
              <Sparkles size={12} />
              PTM Reports · Automated by AI
            </div>

            <h1
              className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight"
              style={{ fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em", color: "#ffffff" }}
            >
              AI-written reports.
              <br />
              <span style={{ color: "#FF6B1F" }}>Approved by teachers.</span>
              <br />
              Delivered to parents.
            </h1>

            <p className="text-lg max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
              Replace the 8-page manual PTM template with a focused AI-generated report.
              The teacher reviews and approves in one click — then the report is delivered to parents
              via email and WhatsApp automatically.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
              <Link
                href="/ptm"
                className="flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold transition-all text-base"
                style={{ background: "#FF6B1F", color: "white", boxShadow: "0 0 40px rgba(255,107,31,0.45)", fontFamily: "var(--font-jakarta)" }}
              >
                Open the App
                <ArrowRight size={16} />
              </Link>
              <a
                href="#how-it-works"
                className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                See how it works
                <ChevronDown size={15} />
              </a>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FF6B1F" }} />
                500+ reports generated
              </span>
              <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FF6B1F" }} />
                65+ teachers
              </span>
              <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FF6B1F" }} />
                ~30 sec per report
              </span>
              <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FF6B1F" }} />
                Gemini 2.5 Flash powered
              </span>
            </div>
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
