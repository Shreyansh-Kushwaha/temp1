"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";

/**
 * Cinematic ambient background — neural grid + interactive flowing strings
 * + floating particles + scan lines + soft light blooms.
 *
 * The three flowing strings react to the cursor: each sample point along the
 * curve is repelled away from the mouse with an inverse-square falloff, then
 * lerps back home when the cursor leaves. Path attributes are mutated directly
 * on the SVG element via refs (no React re-renders) so it stays buttery at 60fps.
 */

const VIEW_W = 1600;
const VIEW_H = 900;
const REPEL_RADIUS_PX = 220;
const REPEL_STRENGTH_PX = 95;
const SPRING = 0.14; // 0–1, higher = snappier follow

interface CurveDef {
  baseY: number;
  amplitude: number;
  phase: number;
  stroke: string;
  width: number;
  opacity: number;
  pointCount: number;
}

const CURVES: CurveDef[] = [
  {
    baseY: 540,
    amplitude: 110,
    phase: 0,
    stroke: "url(#curve-grad-1)",
    width: 1.4,
    opacity: 1,
    pointCount: 38,
  },
  {
    baseY: 240,
    amplitude: 70,
    phase: 1.4,
    stroke: "url(#curve-grad-2)",
    width: 1,
    opacity: 0.7,
    pointCount: 36,
  },
  {
    baseY: 760,
    amplitude: 55,
    phase: 2.6,
    stroke: "url(#curve-grad-3)",
    width: 0.8,
    opacity: 0.55,
    pointCount: 32,
  },
];

interface Pt {
  x: number;
  y: number;
}

function generateCurve(def: CurveDef): Pt[] {
  return Array.from({ length: def.pointCount }, (_, i) => {
    const t = i / (def.pointCount - 1);
    const x = -120 + t * (VIEW_W + 240); // overshoot edges so the curve runs off-screen
    const y = def.baseY + Math.sin(t * Math.PI * 2 + def.phase) * def.amplitude;
    return { x, y };
  });
}

/** Catmull-Rom → cubic bezier — gives smooth curves through every sample point. */
function pointsToSmoothPath(points: Pt[]): string {
  if (points.length < 2) return "";
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(
      2
    )} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

export default function AmbientBackground() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([null, null, null]);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const rafRef = useRef<number | null>(null);

  const baseCurves = useMemo(() => CURVES.map(generateCurve), []);
  const currentRef = useRef<Pt[][]>(baseCurves.map((c) => c.map((p) => ({ ...p }))));

  // Initial path render so first frame isn't empty
  const initialPaths = useMemo(() => baseCurves.map(pointsToSmoothPath), [baseCurves]);

  // Stable random-ish particle positions
  const particles = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const seed = i * 9301 + 49297;
        const r1 = (seed % 233280) / 233280;
        const r2 = ((seed * 7) % 233280) / 233280;
        return {
          x: r1 * 100,
          y: r2 * 100,
          size: 1 + r1 * 2.5,
          duration: 14 + r2 * 18,
          delay: r1 * 12,
          opacity: 0.15 + r2 * 0.5,
        };
      }),
    []
  );

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      const point =
        "touches" in e
          ? (e as TouchEvent).touches[0]
          : (e as MouseEvent);
      if (!point) return;
      mouseRef.current.x = point.clientX;
      mouseRef.current.y = point.clientY;
      mouseRef.current.active = true;
    }
    function onLeave() {
      mouseRef.current.active = false;
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("touchend", onLeave);

    function tick() {
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const active = mouseRef.current.active;
        const sxScale = rect.width / VIEW_W;
        const syScale = rect.height / VIEW_H;

        for (let ci = 0; ci < baseCurves.length; ci++) {
          const base = baseCurves[ci];
          const cur = currentRef.current[ci];

          for (let i = 0; i < base.length; i++) {
            let targetX = base[i].x;
            let targetY = base[i].y;

            if (active) {
              // Convert this point's SVG coord to screen px
              const screenX = rect.left + base[i].x * sxScale;
              const screenY = rect.top + base[i].y * syScale;
              const dx = screenX - mx;
              const dy = screenY - my;
              const dist = Math.hypot(dx, dy);

              if (dist < REPEL_RADIUS_PX) {
                const t = (REPEL_RADIUS_PX - dist) / REPEL_RADIUS_PX;
                const force = t * t * REPEL_STRENGTH_PX; // px outward
                const angle = Math.atan2(dy, dx);
                // Convert px displacement back to SVG units
                targetX += (Math.cos(angle) * force) / sxScale;
                targetY += (Math.sin(angle) * force) / syScale;
              }
            }

            cur[i].x += (targetX - cur[i].x) * SPRING;
            cur[i].y += (targetY - cur[i].y) * SPRING;
          }

          const el = pathRefs.current[ci];
          if (el) {
            el.setAttribute("d", pointsToSmoothPath(cur));
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("touchend", onLeave);
    };
  }, [baseCurves]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Base radial atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 600px at 78% 22%, rgba(255,107,31,0.22), transparent 60%), " +
            "radial-gradient(1100px 700px at 18% 90%, rgba(124,58,237,0.18), transparent 65%), " +
            "radial-gradient(1400px 900px at 50% 50%, rgba(255,255,255,0.04), transparent 70%)",
        }}
      />

      {/* Neural grid (dot pattern) */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.18]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="ambient-grid" width="42" height="42" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.55)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ambient-grid)" />
      </svg>

      {/* Interactive flowing strings */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="curve-grad-1" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(255,107,31,0)" />
            <stop offset="50%" stopColor="rgba(255,107,31,0.65)" />
            <stop offset="100%" stopColor="rgba(255,107,31,0)" />
          </linearGradient>
          <linearGradient id="curve-grad-2" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="curve-grad-3" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(167,139,250,0)" />
            <stop offset="50%" stopColor="rgba(167,139,250,0.5)" />
            <stop offset="100%" stopColor="rgba(167,139,250,0)" />
          </linearGradient>
        </defs>
        {CURVES.map((def, i) => (
          <motion.path
            key={i}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
            d={initialPaths[i]}
            stroke={def.stroke}
            strokeWidth={def.width}
            fill="none"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: def.opacity }}
            transition={{ duration: 1.4, delay: 0.2 + i * 0.15, ease: "easeOut" }}
          />
        ))}
      </svg>

      {/* Light blooms (soft moving orbs) */}
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -25, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[10%] right-[8%] w-[28rem] h-[28rem] rounded-full opacity-70"
        style={{ background: "radial-gradient(circle, rgba(255,107,31,0.35), transparent 65%)", filter: "blur(20px)" }}
      />
      <motion.div
        animate={{ x: [0, -30, 0], y: [0, 35, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[8%] left-[6%] w-[24rem] h-[24rem] rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.32), transparent 65%)", filter: "blur(20px)" }}
      />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: i % 5 === 0 ? "var(--ss-o-400)" : "rgba(255,255,255,0.85)",
            opacity: p.opacity,
            boxShadow: i % 5 === 0 ? "0 0 8px rgba(255,107,31,0.6)" : "0 0 6px rgba(255,255,255,0.35)",
          }}
          animate={{
            y: [0, -22, 0],
            x: [0, 8, 0],
            opacity: [p.opacity * 0.4, p.opacity, p.opacity * 0.4],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.delay,
          }}
        />
      ))}

      {/* Subtle scan lines */}
      <div
        className="absolute inset-0 mix-blend-overlay opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0 1px, transparent 1px 4px)",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 50%, transparent 50%, rgba(10,8,18,0.45) 100%)",
        }}
      />
    </div>
  );
}
