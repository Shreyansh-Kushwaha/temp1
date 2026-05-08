"use client";

/**
 * ScrollPathSystem
 *
 * A cinematic scroll-driven SVG energy path that progressively reveals
 * itself as the user scrolls, weaving organically between page sections.
 *
 * Architecture:
 *   ScrollPathProvider   — wraps page root, broadcasts scrollYProgress via context
 *   ScrollPathSystem     — renders the full-page SVG overlay
 *   usePathProgress      — returns live scroll progress MotionValue
 *   useSectionReach      — returns an activation MotionValue for a section
 *
 * Quick-start integration:
 *   1. Wrap page root: <ScrollPathProvider>...</ScrollPathProvider>
 *   2. Add ref + relative to page root div: ref={pageRef} className="... relative"
 *   3. Render as first child: <ScrollPathSystem containerRef={pageRef} />
 *
 * ─── Tuning constants ───────────────────────────────────────────────────────
 *   WAYPOINTS            section-transition fractional scroll positions
 *   AMBIENT_SECTIONS     per-section ambient highlight positions
 *   buildPath()          path waypoints — adjust fractions to match your layout
 *   PARTICLE_TRAIL_*     offsets for trailing dots
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useRef, useEffect, useState, createContext, useContext } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";

/* ═══════════════════════════════════════════════════
   CONTEXT — shares scroll progress page-wide so any
   component can react without its own useScroll call.
═══════════════════════════════════════════════════ */

const PathCtx = createContext<MotionValue<number> | null>(null);

/** Wrap your page root once to provide scroll progress to all children. */
export function ScrollPathProvider({ children }: { children: React.ReactNode }) {
  const { scrollYProgress } = useScroll();
  return <PathCtx.Provider value={scrollYProgress}>{children}</PathCtx.Provider>;
}

/** Returns the live page scroll progress MotionValue (0 → 1). */
export function usePathProgress(): MotionValue<number> {
  const fallback = useMotionValue(0);
  return useContext(PathCtx) ?? fallback;
}

/**
 * Returns a MotionValue<number> that peaks at 1 when the scroll path
 * enters a section, then fades back to 0 as it leaves.
 *
 * @param from  scroll progress where the activation begins
 * @param peak  scroll progress of maximum activation (path is "here")
 * @param to    scroll progress where activation ends
 *
 * @example
 *   const glow = useSectionReach(0.28, 0.31, 0.44);
 *   <motion.div style={{ boxShadow: useTransform(glow,
 *     [0, 1], ['none', '0 0 40px rgba(255,107,31,0.4)']) }} />
 */
export function useSectionReach(from: number, peak: number, to: number) {
  const progress = usePathProgress();
  return useTransform(progress, [from, peak, to], [0, 1, 0], { clamp: true });
}

/* ═══════════════════════════════════════════════════
   PATH GENERATION
   Produces an organic cubic-bezier SVG path string.
═══════════════════════════════════════════════════ */

/**
 * Section layout calibration (fraction of total page height):
 *
 *   Hero         0.00 – 0.24   (min-height: 90vh)
 *   Stat strip   0.24 – 0.28
 *   How it works 0.28 – 0.44
 *   Features     0.44 – 0.60
 *   Testimonials 0.60 – 0.72
 *   FAQ          0.72 – 0.87
 *   CTA + Footer 0.87 – 1.00
 *
 * The path oscillates horizontally between ~5%–95% of viewport width,
 * crossing back and forth to weave between cards without following a
 * straight timeline.
 */
function buildPath(w: number, h: number, mobile: boolean): string {
  // Horizontal anchor zones (fraction of viewport width)
  // Mobile uses tighter oscillation since layout is single-column
  const cx = w * 0.50;
  const lw = w * (mobile ? 0.08 : 0.06);  // left wide — near edge
  const lm = w * (mobile ? 0.22 : 0.17);  // left mid
  const rm = w * (mobile ? 0.78 : 0.83);  // right mid
  const rw = w * (mobile ? 0.92 : 0.94);  // right wide — near edge

  /** Short-form: "x, y-as-fraction-of-page-height" */
  const p = (x: number, yf: number) =>
    `${x.toFixed(1)},${(h * yf).toFixed(1)}`;

  return [
    `M ${p(cx, 0.00)}`,

    // ── HERO ─────────────────────────────────────────────────────────────
    // Rise right past the h1 / badge
    `C ${p(cx, 0.025)} ${p(rw, 0.06)} ${p(rw, 0.095)}`,
    // Broad arc back left, sweeping past the product mockup
    `C ${p(rw, 0.135)} ${p(rm, 0.175)} ${p(cx, 0.215)}`,
    // Swing further left to the hero bottom / social-proof row
    `C ${p(lm, 0.225)} ${p(lw, 0.235)} ${p(lw, 0.250)}`,

    // ── STAT STRIP ───────────────────────────────────────────────────────
    // Cross rightward through the stat numbers
    `C ${p(lw, 0.262)} ${p(rm, 0.270)} ${p(rm, 0.280)}`,

    // ── HOW IT WORKS — Step cards ────────────────────────────────────────
    // Step 01 card: arc to left edge
    `C ${p(rm, 0.294)} ${p(lm, 0.325)} ${p(lm, 0.345)}`,
    // Step 02 card: pass through center
    `C ${p(lm, 0.362)} ${p(cx, 0.373)} ${p(cx, 0.387)}`,
    // Step 03 card: sweep to right edge
    `C ${p(cx, 0.400)} ${p(rw, 0.413)} ${p(rw, 0.430)}`,

    // ── FEATURES ─────────────────────────────────────────────────────────
    // Sweep hard left past the large 2-column card
    `C ${p(rw, 0.452)} ${p(lm, 0.472)} ${p(lw, 0.492)}`,
    // Cross right through the small feature cards column
    `C ${p(lw, 0.511)} ${p(rm, 0.522)} ${p(rw, 0.535)}`,
    // Converge back to center, exiting the features section
    `C ${p(rw, 0.554)} ${p(cx, 0.563)} ${p(cx, 0.574)}`,

    // ── TESTIMONIALS ─────────────────────────────────────────────────────
    // Left testimonial card
    `C ${p(cx,  0.583)} ${p(lw, 0.610)} ${p(lm, 0.628)}`,
    // Right testimonial card — broad arc
    `C ${p(lm, 0.648)} ${p(rw, 0.668)} ${p(rw, 0.681)}`,
    // Return to center
    `C ${p(rw, 0.693)} ${p(cx, 0.705)} ${p(cx, 0.715)}`,

    // ── FAQ — accordion waves ─────────────────────────────────────────────
    // Each answer is hinted at by an oscillation
    `C ${p(cx,  0.723)} ${p(lm, 0.732)} ${p(lm, 0.745)}`,
    `C ${p(lm,  0.757)} ${p(rm, 0.768)} ${p(rm, 0.779)}`,
    `C ${p(rm,  0.790)} ${p(lm, 0.802)} ${p(lm, 0.813)}`,
    `C ${p(lm,  0.826)} ${p(cx, 0.837)} ${p(cx, 0.848)}`,

    // ── CTA ───────────────────────────────────────────────────────────────
    // Converge to center and descend to footer
    `C ${p(cx, 0.870)} ${p(cx, 0.912)} ${p(cx, 0.938)}`,
    `L ${p(cx, 1.000)}`,
  ].join(" ");
}

/* ═══════════════════════════════════════════════════
   WAYPOINT NODE
   Concentric rings that pulse when the path arrives
   at a section-transition point.
═══════════════════════════════════════════════════ */

interface WaypointProps {
  pathRef:    React.RefObject<SVGPathElement | null>;
  atProgress: number;
  scrollProg: MotionValue<number>;
  /** Re-passed so useEffect re-runs on resize */
  dims: { w: number; h: number };
}

function WaypointNode({ pathRef, atProgress, scrollProg, dims }: WaypointProps) {
  const [pos, setPos] = useState({ x: -9999, y: -9999 });

  // Calculate SVG position after mount and on every resize
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    if (len === 0) return;
    const pt = path.getPointAtLength(atProgress * len);
    setPos({ x: pt.x, y: pt.y });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathRef, atProgress, dims.w, dims.h]);

  // Ramp in → peak → hold → fade out as path approaches and leaves
  const activation = useTransform(
    scrollProg,
    [
      atProgress - 0.018,
      atProgress + 0.010,
      atProgress + 0.075,
      atProgress + 0.120,
    ],
    [0, 1, 0.55, 0],
    { clamp: true }
  );

  const opacityOuter = useTransform(activation, [0, 1], [0, 0.40]);
  const opacityMid   = useTransform(activation, [0, 1], [0, 0.70]);

  return (
    <g>
      {/* Outer halo ring */}
      <motion.circle cx={pos.x} cy={pos.y} r={20}
        fill="none" stroke="#FF6B1F" strokeWidth={0.8}
        style={{ opacity: opacityOuter }}
      />
      {/* Mid ring */}
      <motion.circle cx={pos.x} cy={pos.y} r={10}
        fill="none" stroke="#FF6B1F" strokeWidth={1.2}
        style={{ opacity: opacityMid }}
      />
      {/* Solid core */}
      <motion.circle cx={pos.x} cy={pos.y} r={3}
        fill="#FF6B1F"
        style={{ opacity: activation }}
      />
    </g>
  );
}

/* ═══════════════════════════════════════════════════
   AMBIENT SECTION HIGHLIGHT
   A large, soft radial glow that lights up around
   each section as the path enters it.
═══════════════════════════════════════════════════ */

interface AmbientProps {
  cx: number;
  cy: number;
  radius: number;
  scrollProg: MotionValue<number>;
  from: number;
  peak: number;
  to: number;
}

function AmbientHighlight({ cx, cy, radius, scrollProg, from, peak, to }: AmbientProps) {
  const opacity = useTransform(
    scrollProg,
    [from, peak, to],
    [0, 0.09, 0],  // max 9% opacity — very subtle warmth
    { clamp: true }
  );
  return (
    <motion.circle
      cx={cx} cy={cy} r={radius}
      fill="#FF6B1F"
      style={{ opacity, filter: "blur(90px)" }}
    />
  );
}

/* ═══════════════════════════════════════════════════
   SCROLL PATH SYSTEM  —  main export
═══════════════════════════════════════════════════ */

export interface ScrollPathSystemProps {
  /** Ref to the outermost page div (must have position: relative) */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Section-transition waypoints as fractional scroll progress.
 * These control where the concentric ring nodes appear.
 * Adjust to match your section heights if you alter the layout.
 */
const WAYPOINTS: number[] = [0.145, 0.280, 0.440, 0.575, 0.715, 0.850];

/**
 * Ambient highlight positions.
 * Each entry lights up a soft orange glow as the path passes through.
 */
const AMBIENT_SECTIONS = [
  { yFrac: 0.260, from: 0.225, peak: 0.255, to: 0.310 }, // stat strip
  { yFrac: 0.360, from: 0.300, peak: 0.345, to: 0.435 }, // how it works
  { yFrac: 0.510, from: 0.465, peak: 0.505, to: 0.575 }, // features
  { yFrac: 0.650, from: 0.595, peak: 0.635, to: 0.710 }, // testimonials
  { yFrac: 0.790, from: 0.735, peak: 0.775, to: 0.845 }, // faq
];

/** Trailing particle offset values (fraction of pathLength behind leader) */
const TRAIL_OFFSETS = [
  { ref: "trail1", offset: 0.016, opacity: 0.50, radius: 3.5 },
  { ref: "trail2", offset: 0.038, opacity: 0.20, radius: 2.5 },
];

export function ScrollPathSystem({ containerRef }: ScrollPathSystemProps) {
  /* ── Measure container ─────────────────────────────────────────── */
  const [dims, setDims]     = useState({ w: 1200, h: 8000 });
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      setDims({ w: el.offsetWidth, h: el.scrollHeight });
      setMobile(el.offsetWidth < 768);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [containerRef]);

  /* ── Scroll progress ───────────────────────────────────────────── */
  const { scrollYProgress } = useScroll();

  // pathLength drives the reveal (0 = hidden, 1 = fully drawn)
  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  // System-level fade: ease in at top, ease out approaching footer
  const systemOpacity = useTransform(
    scrollYProgress,
    [0.00, 0.025, 0.930, 1.00],
    [0,    1,     1,     0   ]
  );

  // Glow blobs fade out as we leave the dark hero and enter light sections.
  // The crisp 1.5 px line is NOT in this group — it stays visible everywhere.
  const glowOpacity = useTransform(
    scrollYProgress,
    [0.18, 0.27],
    [1.0,  0.18],
    { clamp: true }
  );

  /* ── Particle DOM refs (direct mutation = no React re-renders) ─── */
  const svgPathRef = useRef<SVGPathElement>(null);
  const coreRef    = useRef<SVGCircleElement>(null);
  const haloRef    = useRef<SVGCircleElement>(null);
  const trail1Ref  = useRef<SVGCircleElement>(null);
  const trail2Ref  = useRef<SVGCircleElement>(null);

  const trailRefs = [trail1Ref, trail2Ref] as const;

  /**
   * Per-frame: mutate SVG circle positions directly.
   * This runs at 60fps driven by Framer Motion's pathLength MotionValue
   * without triggering any React state updates.
   */
  useMotionValueEvent(pathLength, "change", (latest) => {
    const path = svgPathRef.current;
    if (!path) return;
    const total = path.getTotalLength();

    const moveTo = (
      ref: React.RefObject<SVGCircleElement | null>,
      offset: number,
      maxOpacity: number
    ) => {
      if (!ref.current) return;
      const t  = Math.max(0, Math.min(1, latest - offset));
      const pt = path.getPointAtLength(t * total);
      ref.current.setAttribute("cx", pt.x.toFixed(2));
      ref.current.setAttribute("cy", pt.y.toFixed(2));
      ref.current.style.opacity =
        latest > offset + 0.004 ? String(maxOpacity) : "0";
    };

    moveTo(haloRef,    0,               0.70);
    moveTo(coreRef,    0,               1.00);
    moveTo(trail1Ref,  TRAIL_OFFSETS[0].offset, TRAIL_OFFSETS[0].opacity);
    moveTo(trail2Ref,  TRAIL_OFFSETS[1].offset, TRAIL_OFFSETS[1].opacity);
  });

  /* ── Build path ────────────────────────────────────────────────── */
  const d  = buildPath(dims.w, dims.h, mobile);
  const cx = dims.w * 0.5; // center x for ambient highlights

  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
        overflow: "hidden",
        opacity: systemOpacity,
      }}
    >
      <svg
        width={dims.w}
        height={dims.h}
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
      >
        <defs>
          {/* Medium glow — used on trailing dot */}
          <filter id="sp-glow-sm" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Strong glow — used on leading particle core */}
          <filter id="sp-glow-lg" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="16" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Radial gradient for particle halo — soft falloff */}
          <radialGradient id="sp-halo">
            <stop offset="0%"   stopColor="#FF6B1F" stopOpacity="0.65" />
            <stop offset="50%"  stopColor="#FF6B1F" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#FF6B1F" stopOpacity="0"    />
          </radialGradient>
        </defs>

        {/* ── Ambient section highlights ───────────────────────────────
            Large blurred radials that warm up each section as the path
            passes through. Very low opacity — cinematic, not garish.
        ──────────────────────────────────────────────────────────────── */}
        {AMBIENT_SECTIONS.map((s, i) => (
          <AmbientHighlight
            key={i}
            cx={cx}
            cy={dims.h * s.yFrac}
            radius={Math.min(dims.w * 0.42, 440)}
            scrollProg={scrollYProgress}
            from={s.from}
            peak={s.peak}
            to={s.to}
          />
        ))}

        {/* ── Ghost track ──────────────────────────────────────────────
            The full path, always visible as a faint dashed line.
            Hints at where the journey leads before the user scrolls.
        ──────────────────────────────────────────────────────────────── */}
        <path
          d={d}
          fill="none"
          stroke="rgba(255,107,31,0.07)"
          strokeWidth={1.5}
          strokeDasharray="3 22"
          strokeLinecap="round"
        />

        {/* ── Glow blobs — fade out after hero so they don't smear over
            white cards. Crisp line below is NOT in this group.     ── */}
        <motion.g style={{ opacity: glowOpacity }}>
          {/* Wide ambient glow */}
          <motion.path
            d={d}
            fill="none"
            stroke="rgba(255,107,31,0.18)"
            strokeWidth={22}
            strokeLinecap="round"
            style={{ pathLength, filter: "blur(18px)" }}
          />
          {/* Medium glow */}
          <motion.path
            d={d}
            fill="none"
            stroke="rgba(255,107,31,0.42)"
            strokeWidth={5}
            strokeLinecap="round"
            style={{ pathLength, filter: "blur(5px)" }}
          />
        </motion.g>

        {/* ── Crisp main line — always fully visible on any background ── */}
        <motion.path
          ref={svgPathRef}
          d={d}
          fill="none"
          stroke="#FF6B1F"
          strokeWidth={2}
          strokeLinecap="round"
          style={{ pathLength }}
        />

        {/* ── Section waypoint nodes ───────────────────────────────── */}
        {WAYPOINTS.map((wp) => (
          <WaypointNode
            key={wp}
            pathRef={svgPathRef}
            atProgress={wp}
            scrollProg={scrollYProgress}
            dims={dims}
          />
        ))}

        {/* ── Trailing particles ───────────────────────────────────── */}
        {/* Furthest trailing dot (faintest) */}
        <circle
          ref={trail2Ref}
          r={TRAIL_OFFSETS[1].radius}
          fill="#FF6B1F"
          opacity={0}
          style={{ willChange: "cx, cy" }}
        />
        {/* Near trailing dot */}
        <circle
          ref={trail1Ref}
          r={TRAIL_OFFSETS[0].radius}
          fill="#FF6B1F"
          opacity={0}
          style={{ filter: "url(#sp-glow-sm)", willChange: "cx, cy" }}
        />

        {/* ── Leading particle ─────────────────────────────────────── */}
        {/* Soft halo glow */}
        <circle
          ref={haloRef}
          r={26}
          fill="url(#sp-halo)"
          opacity={0}
          style={{ willChange: "cx, cy" }}
        />
        {/* Bright core with strong bloom */}
        <circle
          ref={coreRef}
          r={4.5}
          fill="#FF6B1F"
          opacity={0}
          style={{ filter: "url(#sp-glow-lg)", willChange: "cx, cy" }}
        />
      </svg>
    </motion.div>
  );
}
