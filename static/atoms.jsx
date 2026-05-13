// Shared atoms used across the app

const RATING_TOKENS = {
  STRONG: { fg: "#4ade80", bg: "rgba(34,197,94,0.14)", border: "rgba(34,197,94,0.35)", dot: "#22c55e" },
  VALUE:  { fg: "#93c5fd", bg: "rgba(59,130,246,0.14)", border: "rgba(59,130,246,0.35)", dot: "#3b82f6" },
  NEUTRAL:{ fg: "#cbd5e1", bg: "rgba(120,130,150,0.12)", border: "rgba(120,130,150,0.28)", dot: "#8888a0" },
  AVOID:  { fg: "#fca5a5", bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.35)", dot: "#ef4444" },
};

function RatingBadge({ rating, size = "sm" }) {
  const t = RATING_TOKENS[rating] || RATING_TOKENS.NEUTRAL;
  const padY = size === "sm" ? 2 : 4;
  const padX = size === "sm" ? 7 : 10;
  const fs = size === "sm" ? 10.5 : 12;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: `${padY}px ${padX}px`,
      borderRadius: 4,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: fs, fontWeight: 600, letterSpacing: 0.4,
      color: t.fg, background: t.bg, border: `1px solid ${t.border}`,
      lineHeight: 1, textTransform: "uppercase",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 1, background: t.dot }} />
      {rating}
    </span>
  );
}

function QuotaBadge({ used, limit }) {
  const remaining = limit - used;
  const pct = remaining / limit;
  let color = "#22c55e";
  if (remaining <= 30) color = "#ef4444";
  else if (remaining <= 100) color = "#eab308";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "6px 10px",
      borderRadius: 6, flexShrink: 0, whiteSpace: "nowrap",
      background: "#1a1a23",
      border: "1px solid #2a2a38",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11.5,
      color: "#8888a0",
    }}>
      <span style={{ color: "#5a5a72", textTransform: "uppercase", letterSpacing: 0.6, fontSize: 10 }}>QUOTA</span>
      <span style={{
        width: 60, height: 4, borderRadius: 2, background: "#0f0f13", overflow: "hidden", position: "relative",
      }}>
        <span style={{
          position: "absolute", inset: 0, width: `${pct * 100}%`, background: color,
        }} />
      </span>
      <span style={{ color: "#e8e8f0", fontWeight: 600 }}>{remaining}</span>
      <span style={{ color: "#5a5a72" }}>/ {limit}</span>
    </div>
  );
}

function Sparkline({ data, color = "#6366f1", w = 80, h = 22, line = null }) {
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
  // baseline area
  const area = `M 0,${h} L ` + pts.join(" L ") + ` L ${w},${h} Z`;
  let lineY = null;
  if (line != null) {
    lineY = h - ((line - min) / span) * h;
  }
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <path d={area} fill={color} fillOpacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      {lineY != null && (
        <line x1={0} x2={w} y1={lineY} y2={lineY}
          stroke="#5a5a72" strokeDasharray="2 3" strokeWidth={0.8} />
      )}
      <circle cx={(data.length - 1) * stepX} cy={h - ((data[data.length - 1] - min) / span) * h}
        r={1.6} fill={color} />
    </svg>
  );
}

function MicroBar({ value, max, color = "#6366f1", w = 56, h = 4 }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <span style={{
      display: "inline-block", width: w, height: h, borderRadius: 2,
      background: "#0f0f13", position: "relative", verticalAlign: "middle",
    }}>
      <span style={{
        position: "absolute", inset: 0, width: `${pct * 100}%`, background: color, borderRadius: 2,
      }} />
    </span>
  );
}

const SHIMMER_STYLE = (() => {
  if (!document.getElementById("nba-shimmer-style")) {
    const s = document.createElement("style");
    s.id = "nba-shimmer-style";
    s.textContent = `
      @keyframes nba-shimmer {
        0%   { background-position: -400px 0; }
        100% { background-position:  400px 0; }
      }
      .nba-skeleton {
        background: linear-gradient(90deg, #1a1a23 25%, #2a2a38 50%, #1a1a23 75%);
        background-size: 800px 100%;
        animation: nba-shimmer 1.4s infinite linear;
        border-radius: 4px;
      }
    `;
    document.head.appendChild(s);
  }
  return null;
})();

function SkeletonBlock({ w = "100%", h = 16, style = {} }) {
  SHIMMER_STYLE;
  return (
    <span className="nba-skeleton" style={{ display: "block", width: w, height: h, ...style }} />
  );
}

function Tooltip({ text, children }) {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#1e1e28", border: "1px solid #3a3a4a",
          color: "#cbd5e1", fontSize: 11.5,
          fontFamily: "'Inter Tight', sans-serif",
          fontWeight: 400, letterSpacing: 0,
          padding: "6px 10px", borderRadius: 5,
          whiteSpace: "nowrap", maxWidth: 280, lineHeight: 1.5,
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          zIndex: 100, pointerEvents: "none",
          textTransform: "none",
        }}>{text}</span>
      )}
    </span>
  );
}

// number / odds formatting
function fmtOdd(o, mode) {
  if (mode === "implied") return `${(100 / o).toFixed(1)}%`;
  return o.toFixed(2);
}
function fmtPct(v, digits = 1) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}
function fmtProb(p) { return `${(p * 100).toFixed(1)}%`; }

const KELLY_DIVISORS = { full: 1, half: 2, quarter: 4, eighth: 8 };
function fmtKelly(fullPct, mode) {
  const d = KELLY_DIVISORS[mode] || 4;
  return `${(fullPct / d).toFixed(1)}%`;
}

// ── A. FlashCell — pisca verde quando valor sobe, vermelho quando desce ──
function FlashCell({ value, format = (v) => v, style = {} }) {
  const prevRef = React.useRef(value);
  const [pulse, setPulse] = React.useState(0);
  const [dir, setDir] = React.useState(null);

  React.useEffect(() => {
    if (prevRef.current !== value && prevRef.current !== undefined) {
      setDir(value > prevRef.current ? "up" : "down");
      setPulse(p => p + 1);
      const t = setTimeout(() => setDir(null), 1500);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
    prevRef.current = value;
  }, [value]);

  const cls = `flash-cell${dir === "up" ? " flash-up" : dir === "down" ? " flash-down" : ""}`;
  return (
    <span key={pulse} className={cls} style={style}>
      <span className="flash-arrow">{dir === "up" ? "▲" : "▼"}</span>
      {format(value)}
    </span>
  );
}

// ── B. TrendSparkline — mini gráfico com pontos verde/vermelho por hit/miss ──
// data: [{value, hit}] — hit=true => Over batido (verde), false => miss (vermelho)
function TrendSparkline({ data, line, w = 64, h = 20 }) {
  if (!data?.length) return null;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals, line ?? Math.min(...vals));
  const max = Math.max(...vals, line ?? Math.max(...vals));
  const span = max - min || 1;
  const stepX = data.length > 1 ? w / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({
    x: data.length > 1 ? i * stepX : w / 2,
    y: h - ((d.value - min) / span) * h,
    hit: d.hit,
  }));
  const path = "M " + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");
  const lineY = line != null ? h - ((line - min) / span) * h : null;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      {lineY != null && (
        <line x1={0} x2={w} y1={lineY} y2={lineY}
          stroke="#5a5a72" strokeDasharray="2 3" strokeWidth={0.7} opacity={0.7} />
      )}
      <path d={path} fill="none" stroke="#3a3a4a" strokeWidth={1.2}
        strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.2}
          fill={p.hit ? "#5ee2a0" : "#ff7e8a"}
          stroke="#141419" strokeWidth={1} />
      ))}
    </svg>
  );
}

// ── D. Gauge — velocímetro semicircular (cinza → amarelo → verde neón) ──
// value normalizado 0..1
function Gauge({ value, w = 56, h = 32, thickness = 5 }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const cx = w / 2, cy = h - 2;
  const r = Math.min(cx, h - thickness) - thickness / 2;
  const startAngle = Math.PI, endAngle = 0;
  const angle = startAngle + (endAngle - startAngle) * v;

  const arc = (a0, a1) => {
    const x0 = cx + r * Math.cos(a0), y0 = cy - r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy - r * Math.sin(a1);
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    const sweep = a1 < a0 ? 1 : 0;
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };

  const dotColor = v < 0.33 ? "#5a5a72" : v < 0.66 ? "#f5c451" : "#5ee2a0";
  const gid = `g${Math.round(v * 1000)}_${w}`;

  return (
    <svg width={w} height={h} style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#3a3a4a" />
          <stop offset="45%"  stopColor="#f5c451" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#5ee2a0" />
        </linearGradient>
      </defs>
      <path d={arc(startAngle, endAngle)}
        fill="none" stroke="#1c1c25" strokeWidth={thickness} strokeLinecap="round" />
      {v > 0.01 && (
        <path d={arc(startAngle, angle)}
          fill="none" stroke={`url(#${gid})`} strokeWidth={thickness} strokeLinecap="round"
          style={{ filter: v >= 0.66 ? "drop-shadow(0 0 4px #5ee2a0)" : "none" }} />
      )}
      <circle cx={cx + r * Math.cos(angle)} cy={cy - r * Math.sin(angle)}
        r={2.2} fill={dotColor}
        style={{ filter: v >= 0.66 ? "drop-shadow(0 0 3px #5ee2a0)" : "none" }} />
    </svg>
  );
}

// Normaliza EV% (-5..15) → 0..1 para o Gauge
function normEv(ev)   { return Math.max(0, Math.min(1, (ev + 5) / 20)); }
// Normaliza Kelly% (0..5) → 0..1
function normKelly(k) { return Math.max(0, Math.min(1, k / 5)); }

Object.assign(window, {
  RATING_TOKENS, RatingBadge, QuotaBadge, Sparkline, MicroBar, Tooltip, SkeletonBlock,
  FlashCell, TrendSparkline, Gauge, normEv, normKelly,
  fmtOdd, fmtPct, fmtProb, fmtKelly,
});
