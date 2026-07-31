// Átomos compartilhados — migrados de static/atoms.jsx (estilos inline preservados).
// Os tokens de cor por rating vêm de lib/ratingTokens (fonte única, reusada pelo dashboard).

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { animate, m, useMotionValue, useReducedMotion, useTransform } from "motion/react";

import { ratingToken } from "../../lib/ratingTokens";
import type { Last5Value } from "../../types/api";

/**
 * Número "vivo": conta de 0 (no mount) e do valor antigo → novo quando `value`
 * muda (refetch/atualização de odds). Respeita prefers-reduced-motion.
 * `format` recebe o valor interpolado a cada frame.
 */
export function CountUp({
  value,
  format = (v) => v.toFixed(0),
  className,
  flash = false,
  outlier = false,
}: {
  value: number;
  format?: (v: number) => string;
  className?: string;
  /** Pulsa um tint direcional (verde sobe / vermelho desce) quando o valor muda. */
  flash?: boolean;
  /** Aberração cromática one-shot no mount (destaca um valor excepcional/outlier). */
  outlier?: boolean;
}) {
  // useReducedMotion lê o SO direto (ignora o MotionConfig), então combinamos com
  // o override de dev p/ ficar consistente com o MotionProvider.
  const reduce = useReducedMotion() && import.meta.env.VITE_FORCE_MOTION !== "1";
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => format(v));
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      mv.set(value);
    } else {
      animate(mv, value, { duration: 0.7, ease: [0.22, 1, 0.36, 1] });
    }
    // Flash direcional (tint que decai) — só quando o valor muda de verdade.
    if (flash && !reduce && prev.current !== null && value !== prev.current && ref.current) {
      const up = value > prev.current;
      ref.current.animate(
        [
          { backgroundColor: up ? "rgba(74,222,128,0.30)" : "rgba(252,165,165,0.30)" },
          { backgroundColor: "rgba(0,0,0,0)" },
        ],
        { duration: 700, easing: "cubic-bezier(0.4,0,0.2,1)" },
      );
    }
    prev.current = value;
  }, [value, reduce, mv, flash]);

  if (reduce) return <span className={className}>{format(value)}</span>;
  return (
    <m.span
      ref={ref}
      className={outlier ? `${className ?? ""} rgb-split` : className}
      style={{ borderRadius: 4, padding: "0 3px", margin: "0 -3px" }}
    >
      {text}
    </m.span>
  );
}

export function RatingBadge({ rating, size = "sm" }: { rating: string; size?: "sm" | "md" }) {
  const t = ratingToken(rating);
  const padY = size === "sm" ? 2 : 4;
  const padX = size === "sm" ? 7 : 10;
  const fs = size === "sm" ? 10.5 : 12;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: `${padY}px ${padX}px`,
        borderRadius: 4,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: 0.4,
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.border}`,
        lineHeight: 1,
        textTransform: "uppercase",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 1, background: t.dot }} />
      {rating}
    </span>
  );
}

export function QuotaBadge({ used, limit }: { used: number; limit: number }) {
  const remaining = limit - used;
  const pct = remaining / limit;
  let color = "#22c55e";
  if (remaining <= 30) color = "#ef4444";
  else if (remaining <= 100) color = "#eab308";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 10px",
        borderRadius: 6,
        flexShrink: 0,
        whiteSpace: "nowrap",
        background: "#1a1a23",
        border: "1px solid #2a2a38",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11.5,
        color: "#8888a0",
      }}
    >
      <span style={{ color: "#5a5a72", textTransform: "uppercase", letterSpacing: 0.6, fontSize: 10 }}>QUOTA</span>
      <span style={{ width: 60, height: 4, borderRadius: 2, background: "#0f0f13", overflow: "hidden", position: "relative" }}>
        <span style={{ position: "absolute", inset: 0, width: `${pct * 100}%`, background: color }} />
      </span>
      <span style={{ color: "#e8e8f0", fontWeight: 600 }}>{remaining}</span>
      <span style={{ color: "#5a5a72" }}>/ {limit}</span>
    </div>
  );
}

export function Sparkline({
  data,
  color = "#6366f1",
  w = 80,
  h = 22,
  line = null,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
  line?: number | null;
}) {
  if (!data?.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / span) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = "M " + pts.join(" L ");
  const area = `M 0,${h} L ` + pts.join(" L ") + ` L ${w},${h} Z`;
  const lineY = line != null ? h - ((line - min) / span) * h : null;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <path d={area} fill={color} fillOpacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      {lineY != null && <line x1={0} x2={w} y1={lineY} y2={lineY} stroke="#5a5a72" strokeDasharray="2 3" strokeWidth={0.8} />}
      <circle cx={(data.length - 1) * stepX} cy={h - ((data[data.length - 1] - min) / span) * h} r={1.6} fill={color} />
    </svg>
  );
}

export function SkeletonBlock({
  w = "100%",
  h = 16,
  style = {},
}: {
  w?: number | string;
  h?: number | string;
  style?: CSSProperties;
}) {
  return <span className="skeleton" style={{ display: "block", width: w, height: h, borderRadius: 4, ...style }} />;
}

export function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1e1e28",
            border: "1px solid #3a3a4a",
            color: "#cbd5e1",
            fontSize: 11.5,
            fontFamily: "'Inter Tight', sans-serif",
            fontWeight: 400,
            padding: "6px 10px",
            borderRadius: 5,
            whiteSpace: "nowrap",
            maxWidth: 280,
            lineHeight: 1.5,
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            zIndex: 100,
            pointerEvents: "none",
            textTransform: "none",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

/** Pisca verde quando o valor sobe, vermelho quando desce (usa .flash-cell do global.css).
 *  Com `afterimage`, um "fantasma" do valor antigo desliza e some (leitura periférica
 *  da magnitude/direção da mudança). */
export function FlashCell({
  value,
  format = (v: number) => String(v),
  style = {},
  afterimage = false,
}: {
  value: number;
  format?: (v: number) => string;
  style?: CSSProperties;
  afterimage?: boolean;
}) {
  const prevRef = useRef<number | undefined>(value);
  const [pulse, setPulse] = useState(0);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const [ghost, setGhost] = useState<{ text: string; up: boolean } | null>(null);

  useEffect(() => {
    if (prevRef.current !== value && prevRef.current !== undefined) {
      const up = value > prevRef.current;
      setDir(up ? "up" : "down");
      setPulse((p) => p + 1);
      if (afterimage) setGhost({ text: format(prevRef.current), up });
      const t = setTimeout(() => setDir(null), 1500);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
    prevRef.current = value;
  }, [value, afterimage, format]);

  const cls = `flash-cell${dir === "up" ? " flash-up" : dir === "down" ? " flash-down" : ""}`;
  return (
    <span style={{ position: "relative", display: "inline-flex", justifyContent: "flex-end", ...style }}>
      <span key={pulse} className={cls}>
        {dir && <span className="flash-arrow">{dir === "up" ? "▲" : "▼"}</span>}
        {format(value)}
      </span>
      {afterimage && ghost && (
        <m.span
          key={`g${pulse}`}
          aria-hidden
          className="pointer-events-none tabular-nums"
          style={{ position: "absolute", right: 0, top: 0, color: ghost.up ? "#5ee2a0" : "#ff7e8a" }}
          initial={{ opacity: 0.6, y: 0 }}
          animate={{ opacity: 0, y: ghost.up ? -12 : 12 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          onAnimationComplete={() => setGhost(null)}
        >
          {ghost.text}
        </m.span>
      )}
    </span>
  );
}

/** Sparkline centrado na linha da prop: pontos acima = hit (verde), abaixo = miss (vermelho). */
export function TrendSparkline({
  data,
  line,
  w = 72,
  h = 26,
  reveal = false,
}: {
  data: Last5Value[];
  line?: number | null;
  w?: number;
  h?: number;
  /** Reveal rico (usado no accordion): traço desenha e os pontos surgem em sequência. */
  reveal?: boolean;
}) {
  if (!data?.length) return null;
  const deviations = data.map((d) => d.value - (line ?? 0));
  const absMax = Math.max(...deviations.map(Math.abs), 0.5);
  const pad = 3;
  const midY = h / 2;
  const stepX = data.length > 1 ? w / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({
    x: data.length > 1 ? i * stepX : w / 2,
    y: midY - (deviations[i] / absMax) * (midY - pad),
    hit: d.hit,
  }));
  const path = "M " + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");
  const hits = deviations.filter((v) => v > 0).length;
  const allHit = hits === data.length;
  const allMiss = hits === 0;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <rect x={0} y={0} width={w} height={midY} fill={allHit ? "rgba(94,226,160,0.06)" : "rgba(94,226,160,0.03)"} />
      <rect x={0} y={midY} width={w} height={midY} fill={allMiss ? "rgba(255,126,138,0.06)" : "rgba(255,126,138,0.03)"} />
      <line x1={0} x2={w} y1={midY} y2={midY} stroke="#5a5a72" strokeDasharray="3 3" strokeWidth={0.8} />
      <m.path
        d={path}
        fill="none"
        stroke="#3a3a52"
        strokeWidth={1.3}
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reveal ? 0.9 : 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
      {pts.map((p, i) =>
        reveal ? (
          // pontos "pipocam" em sequência, começando depois do traço desenhar
          <m.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === data.length - 1 ? 3 : 2.1}
            fill={p.hit ? "#5ee2a0" : "#ff7e8a"}
            stroke="#141419"
            strokeWidth={i === data.length - 1 ? 1.2 : 0.8}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.09, type: "spring", stiffness: 520, damping: 24 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        ) : (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === data.length - 1 ? 3 : 2.1}
            fill={p.hit ? "#5ee2a0" : "#ff7e8a"}
            stroke="#141419"
            strokeWidth={i === data.length - 1 ? 1.2 : 0.8}
          />
        ),
      )}
      {/* live playhead: halo "radar" pulsando no ponto mais recente (série ao vivo) */}
      {pts.length > 0 && (
        <m.circle
          cx={pts[pts.length - 1].x}
          cy={pts[pts.length - 1].y}
          r={2.6}
          fill="none"
          stroke={pts[pts.length - 1].hit ? "#5ee2a0" : "#ff7e8a"}
          strokeWidth={1}
          initial={{ scale: 1, opacity: 0.55 }}
          animate={{ scale: [1, 2.6], opacity: [0.55, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: reveal ? 1 : 0 }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      )}
    </svg>
  );
}

/** Velocímetro semicircular (cinza → amarelo → verde neón). value normalizado 0..1. */
export function Gauge({ value, w = 56, h = 32, thickness = 5 }: { value: number; w?: number; h?: number; thickness?: number }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const cx = w / 2;
  const cy = h - 2;
  const r = Math.min(cx, h - thickness) - thickness / 2;
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle + (endAngle - startAngle) * v;

  const arc = (a0: number, a1: number) => {
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy - r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    const sweep = a1 < a0 ? 1 : 0;
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };

  // Cor única via currentColor (herda o token de EV do container). Sem gradiente
  // "arcoíris" — segue as cores já definidas (ev-strong/pos/neutral/neg).
  return (
    <svg width={w} height={h} style={{ display: "block", flexShrink: 0 }}>
      <path d={arc(startAngle, endAngle)} fill="none" stroke="var(--c-raised)" strokeWidth={thickness} strokeLinecap="round" />
      {v > 0.01 && (
        // key por valor → redesenha o arco (pathLength 0→1) quando o EV muda no refresh
        <m.path
          key={v.toFixed(2)}
          d={arc(startAngle, angle)}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
      <circle cx={cx + r * Math.cos(angle)} cy={cy - r * Math.sin(angle)} r={2.2} fill="currentColor" />
    </svg>
  );
}
