// Landing / Home — porta de entrada de marketing antes do painel. Fica FORA do
// <Layout> (sem FAB de tweaks). Dark-first, tokenizada. Tratamentos portados do
// protótipo (hero-proto.html) via Motion: hero com zoom de câmera + traves +
// linha de EV viva + bolinha piscando; ícones dos cards animam no hover; botões
// com sheen; fosco dourado por seção. Efeitos interativos em Motion (não CSS)
// porque o bloco global de prefers-reduced-motion mata animação CSS — assim eles
// respeitam o MotionConfig (e o override de dev VITE_FORCE_MOTION).

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { m, type TargetAndTransition, type Variants } from "motion/react";
import { useNavigate } from "react-router-dom";

import { ThemeToggle } from "../../components/ThemeToggle";
import { cn } from "../../lib/cn";
import { PropsTableTerminal } from "../Dashboard/PropsTableTerminal";
import { SAMPLE_PROPS } from "./sampleProps";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

// reduce = OS pede reduzir movimento E não há override de dev.
// Valor inicial no lazy initializer (evita setState síncrono no effect); o effect
// só assina mudanças do media query.
function useAppReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => {
    if (import.meta.env.VITE_FORCE_MOTION === "1" || typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (import.meta.env.VITE_FORCE_MOTION === "1") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/* ---- ícones (stroke = currentColor, 20px) ---- */
const sv = "h-5 w-5";
function IconTrend() {
  return (
    <svg className={sv} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 3 3 5-6" />
      <path d="M15 7h4v4" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg className={sv} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconArrowUp() {
  return (
    <svg className={sv} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}
function IconList() {
  return (
    <svg className={sv} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg className={sv} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 4h12v4a6 6 0 0 1-12 0V4Z" />
      <path d="M18 5h2a2 2 0 0 1-2 4M6 5H4a2 2 0 0 0 2 4" />
      <path d="M12 14v4M9 21h6M10 18h4" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg className={sv} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent font-mono text-[13px] font-bold text-accent-fg shadow-md">
        NS
      </div>
      <div className="text-base font-bold leading-none tracking-tight">NBA Scout</div>
    </div>
  );
}

/* Botão âmbar com sheen que varre no hover + leve elevação (Motion → respeita a flag). */
function AmberButton({ onClick, children, className }: { onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <m.button
      onClick={onClick}
      initial="rest"
      animate="rest"
      whileHover="hov"
      whileTap={{ scale: 0.97 }}
      variants={{ rest: { scale: 1, y: 0 }, hov: { scale: 1.02, y: -2 } }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className={cn(
        "btn-amber relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-6 py-3 text-base font-semibold",
        className,
      )}
    >
      <span className="relative z-[1] inline-flex items-center gap-2">{children}</span>
      <m.span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.4), transparent)", transform: "skewX(-22deg)" }}
        variants={{ rest: { x: "-180%", opacity: 0 }, hov: { x: "460%", opacity: [0, 1, 0] } }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </m.button>
  );
}

/* Linha de EV VIVA — rola pra frente (novos pontos pela direita) + bolinha piscando.
   rAF puro (respeita reduce): desenha estática se reduzir movimento. */
function LiveLine() {
  const reduce = useAppReducedMotion();
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const W = 400;
    const H = 500; // frame retrato (4/5) — igual ao protótipo
    const base = 430;
    const band = 50;
    const step = 30;
    const DOTX = 388;
    const count = Math.ceil(W / step) + 3;
    const ys: number[] = [];
    let v = base;
    for (let i = 0; i <= count; i++) {
      v += Math.random() * 24 - 12;
      v = Math.max(base - band, Math.min(base + band, v));
      ys.push(v);
    }
    const yAt = (px: number, off: number) => {
      for (let i = 0; i < ys.length - 1; i++) {
        const x0 = i * step - off;
        const x1 = (i + 1) * step - off;
        if (px >= x0 && px <= x1) {
          const t = (px - x0) / (x1 - x0);
          return ys[i] + (ys[i + 1] - ys[i]) * t;
        }
      }
      return ys[ys.length - 1];
    };
    const render = (off: number) => {
      let d = "";
      for (let i = 0; i < ys.length; i++) d += (i ? " L" : "M") + (i * step - off).toFixed(1) + " " + ys[i].toFixed(1);
      lineRef.current?.setAttribute("d", d);
      areaRef.current?.setAttribute("d", `${d} L${W} ${H} L0 ${H} Z`);
      dotRef.current?.setAttribute("cy", yAt(DOTX, off).toFixed(1));
    };
    if (reduce) {
      render(0);
      return;
    }
    let off = 0;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      off += 0.3;
      if (off >= step) {
        off -= step;
        ys.shift();
        const nv = ys[ys.length - 1] + (Math.random() * 24 - 12);
        ys.push(Math.max(base - band, Math.min(base + band, nv)));
      }
      render(off);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <path ref={areaRef} fill="rgba(245,158,11,.10)" stroke="none" />
      <path ref={lineRef} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <m.circle
        ref={dotRef}
        r={4}
        cx={384}
        fill="#f59e0b"
        style={{ filter: "drop-shadow(0 0 7px #f59e0b)" }}
        animate={{ opacity: [1, 0.18, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
}

interface Lane {
  base: number;
  amp: number;
  op: number;
  sp: number;
  hi: boolean;
  pts: number[];
  off: number;
}

/* Parede de gráficos: faixas âmbar (random-walk) rolando pra esquerda atrás do hero.
   Canvas + rAF; estático sob reduced-motion. */
function ChartWall() {
  const reduce = useAppReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const c = document.createElement("canvas");
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    host.appendChild(c);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const step = 30;
    const size = () => {
      W = host.clientWidth;
      H = host.clientHeight;
      c.width = W * dpr;
      c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener("resize", size);

    const LANES: Lane[] = [
      { base: 0.18, amp: 0.1, op: 0.14, sp: 0.01, hi: false, pts: [], off: 0 },
      { base: 0.4, amp: 0.13, op: 0.16, sp: 0.014, hi: false, pts: [], off: 0 },
      { base: 0.56, amp: 0.18, op: 0.42, sp: 0.018, hi: true, pts: [], off: 0 },
      { base: 0.72, amp: 0.11, op: 0.16, sp: 0.012, hi: false, pts: [], off: 0 },
      { base: 0.88, amp: 0.08, op: 0.13, sp: 0.009, hi: false, pts: [], off: 0 },
    ];
    const n = Math.ceil(2200 / step) + 3;
    for (const l of LANES) {
      let v = Math.random();
      for (let i = 0; i < n; i++) {
        v += (Math.random() - 0.5) * 0.5;
        v = Math.max(0, Math.min(1, v));
        l.pts.push(v);
      }
    }
    const drawLane = (l: Lane) => {
      const count = Math.ceil(W / step) + 2;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const val = l.pts[i] ?? 0.5;
        const x = i * step - l.off;
        const y = H * l.base - (val - 0.5) * 2 * (H * l.amp);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(245,158,11,${l.op})`;
      ctx.lineWidth = l.hi ? 1.4 : 1;
      ctx.setLineDash(l.hi ? [] : [4, 5]);
      ctx.stroke();
      if (l.hi) {
        const count2 = Math.ceil(W / step) + 2;
        const lastX = (count2 - 1) * step - l.off;
        const lv = l.pts[count2 - 1] ?? 0.5;
        const lastY = H * l.base - (lv - 0.5) * 2 * (H * l.amp);
        ctx.beginPath();
        ctx.arc(lastX, lastY, 2.4, 0, 7);
        ctx.fillStyle = "rgba(245,158,11,.5)";
        ctx.fill();
      }
    };
    let raf = 0;
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      for (const l of LANES) {
        l.off += l.sp * step * 2;
        if (l.off >= step) {
          l.off -= step;
          l.pts.shift();
          const last = l.pts[l.pts.length - 1];
          l.pts.push(Math.max(0, Math.min(1, last + (Math.random() - 0.5) * 0.5)));
        }
        drawLane(l);
      }
      raf = requestAnimationFrame(frame);
    };
    if (reduce) {
      ctx.clearRect(0, 0, W, H);
      for (const l of LANES) drawLane(l);
    } else {
      frame();
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      if (c.parentNode) c.parentNode.removeChild(c);
    };
  }, [reduce]);

  return <div ref={hostRef} className="pointer-events-none absolute inset-0 z-0" aria-hidden />;
}

const TICK_VARIANTS: Record<string, Variants> = {
  tl: { rest: { x: 0, y: 0 }, hov: { x: 26, y: 26 } },
  tr: { rest: { x: 0, y: 0 }, hov: { x: -26, y: 26 } },
  bl: { rest: { x: 0, y: 0 }, hov: { x: 26, y: -26 } },
  br: { rest: { x: 0, y: 0 }, hov: { x: -26, y: -26 } },
};

/* Hero frame — foto com zoom de câmera no hover + traves fechando + linha viva. */
function HeroFrame() {
  return (
    <m.div
      initial="rest"
      animate="rest"
      whileHover="hov"
      className="hero-frame group relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-border-strong"
      style={{ background: "linear-gradient(135deg, var(--c-raised), var(--c-surface) 45%, var(--c-canvas))", cursor: "crosshair" }}
    >
      <m.img
        src="/landing-kawhi.webp"
        alt="Kawhi Leonard — playoffs"
        loading="lazy"
        decoding="async"
        variants={{ rest: { scale: 1 }, hov: { scale: 1.14 } }}
        transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
        className="absolute inset-0 h-full w-full object-cover brightness-[.68] saturate-[.9] contrast-[1.06]"
      />
      {/* duotone âmbar + gradiente de leitura + grid de quadra */}
      <div className="absolute inset-0" style={{ mixBlendMode: "color", background: "linear-gradient(180deg, transparent, rgba(245,158,11,.18))" }} aria-hidden />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,10,13,.12), rgba(10,10,13,.82))" }} aria-hidden />
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: "linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden
      />

      <LiveLine />

      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <m.span key={c} className={`hero-tick ${c}`} variants={TICK_VARIANTS[c]} transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }} />
      ))}

      <div className="absolute right-3 bottom-3 flex flex-wrap justify-end gap-2 font-mono text-[11px] text-fg-muted">
        <span className="rounded-md border border-border bg-canvas/80 px-2.5 py-1 backdrop-blur">4 jogos monitorados hoje</span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-canvas/80 px-2.5 py-1 backdrop-blur">
          <span className="live-dot" /> 6 strong bets ativas
        </span>
      </div>
    </m.div>
  );
}

interface Feature {
  icon: ReactNode;
  title: string;
  desc: string;
  hover: TargetAndTransition;
  origin?: string;
  dur: number;
}

const FEATURES: Feature[] = [
  {
    icon: <IconTrend />,
    title: "EV% em tempo real",
    desc: "Probabilidade real estimada a partir dos últimos 10 jogos, ponderada por playoffs, defesa e pace do adversário, e comparada à odd da casa.",
    hover: { scale: [1, 1.16, 1] },
    dur: 0.5,
  },
  {
    icon: <IconClock />,
    title: "Odds ao vivo",
    desc: "Linhas e odds atualizam em tempo real e piscam quando mudam: verde subiu, vermelho desceu. Você vê o mercado se mexer.",
    hover: { rotate: [0, -15, 15, 0] },
    dur: 0.9,
  },
  {
    icon: <IconArrowUp />,
    title: "Kelly fracionado",
    desc: "Stake sugerida por Kelly / 4 conservador, calculada por prop. Gauge visual mostra a força da entrada de relance.",
    hover: { y: [0, -5, 0] },
    dur: 0.6,
  },
  {
    icon: <IconList />,
    title: "Rating por prop",
    desc: "Cada entrada classificada como STRONG, VALUE, NEUTRAL ou AVOID, com critérios transparentes de EV mínimo e probabilidade real.",
    hover: { x: [0, 3, 0] },
    dur: 0.5,
  },
  {
    icon: <IconTrophy />,
    title: "Histórico de playoffs",
    desc: "Médias de playoffs de temporadas anteriores entram no cálculo quando a amostra é confiável. Jogos de PO destacados no histórico.",
    hover: { rotate: [0, -13, 11, -8, 6, 0], y: [0, -2, -3, -2, -1, 0] },
    origin: "bottom center",
    dur: 1,
  },
  {
    icon: <IconRefresh />,
    title: "Cache inteligente",
    desc: "Resultados salvos entre sessões e quota da Odds API monitorada. 500 requests por mês rendem a temporada inteira.",
    hover: { rotate: 360 },
    dur: 0.8,
  },
];

/* Card de recurso: hover via ESTADO (onHoverStart/End) — não depende de propagação
   de variant (que não disparava) e respeita o MotionConfig/flag de dev. */
function FeatureCard({ f }: { f: Feature }) {
  const [hovered, setHovered] = useState(false);
  return (
    <m.article
      variants={item}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn("rounded-2xl border bg-surface p-6 transition-colors", hovered ? "border-border-strong" : "border-border")}
    >
      <div
        className={cn(
          "mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border bg-accent/10 text-accent transition-colors",
          hovered ? "border-accent/50 bg-accent/16" : "border-accent/25",
        )}
      >
        <m.span
          animate={hovered ? f.hover : { rotate: 0, scale: 1, x: 0, y: 0 }}
          transition={{ duration: f.dur, ease: "easeInOut" }}
          style={{ display: "inline-flex", transformOrigin: f.origin ?? "center" }}
        >
          {f.icon}
        </m.span>
      </div>
      <h3 className="mb-2 text-lg font-semibold tracking-tight">{f.title}</h3>
      <p className="text-sm leading-relaxed text-fg-muted">{f.desc}</p>
    </m.article>
  );
}

/* Painel-exemplo: o PropsTableTerminal REAL com dados de amostra — jogável
   (ordena/expande/favorita) como preview antes de entrar. */
function ExamplePanel() {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState("ev_pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const onSort = (k: string) => {
    if (k === sortBy) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortBy(k);
      setSortDir("desc");
    }
  };
  const rows = useMemo(() => {
    const arr = [...SAMPLE_PROPS];
    arr.sort((a, b) => {
      const A = (a as unknown as Record<string, unknown>)[sortBy];
      const B = (b as unknown as Record<string, unknown>)[sortBy];
      const r = typeof A === "number" && typeof B === "number" ? A - B : String(A).localeCompare(String(B));
      return sortDir === "desc" ? -r : r;
    });
    return arr;
  }, [sortBy, sortDir]);

  return (
    <PropsTableTerminal
      props={rows}
      onPlayer={(n) => navigate(`/player/${encodeURIComponent(n)}`)}
      oddMode="decimal"
      kellyMode="quarter"
      bankroll={0}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
      replay={`${sortBy}-${sortDir}`}
    />
  );
}

export function Landing() {
  const navigate = useNavigate();
  const openPanel = () => navigate("/dashboard");
  const scrollToFeatures = () => document.getElementById("recursos")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="landing min-h-screen bg-canvas font-sans text-fg">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3.5 md:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={openPanel}
              className="rounded-lg border border-border-strong bg-surface px-3.5 py-2 text-sm font-medium text-fg transition-colors hover:border-fg-subtle hover:bg-raised"
            >
              Entrar no painel →
            </button>
          </div>
        </div>
      </header>

      {/* Hero — 2 colunas: texto à esquerda, foto (retrato) à direita; chartWall atrás.
          NÃO usa .landing-matte aqui: a regra `.landing-matte > *` forçaria os filhos
          a position:relative e colapsaria o canvas do ChartWall. */}
      <section className="relative overflow-hidden border-b border-border">
        <ChartWall />
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: "radial-gradient(70% 80% at 70% 0%, rgba(245,158,11,0.12), transparent 60%)" }}
          aria-hidden
        />
        <div className="relative z-[2] mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
          <m.div variants={container} initial="hidden" animate="show" className="text-left">
            <m.div variants={item} className="mb-6 flex">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 font-mono text-xs text-fg-muted">
                <span className="live-dot" /> Odds ao vivo · playoffs 2026
              </span>
            </m.div>

            <m.h1 variants={item} className="text-balance text-4xl font-extrabold leading-[1.03] tracking-tight md:text-6xl">
              Aposte com matemática,
              <br />
              <span className="text-fg-muted">não com palpite.</span>
            </m.h1>

            <m.p variants={item} className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
              O NBA Scout cruza <span className="font-semibold text-fg">stats reais</span>,{" "}
              <span className="font-semibold text-fg">odds ao vivo</span> e{" "}
              <span className="font-semibold text-fg">defesa do adversário</span> para encontrar props com valor esperado
              positivo. EV%, Kelly e rating em um único painel.
            </m.p>

            <m.div variants={item} className="mt-5 font-mono text-[12.5px] tracking-[0.05em] text-accent">
              6 STRONG BETS ATIVAS · EV+ médio 11.4%
            </m.div>

            <m.div variants={item} className="mt-8 flex flex-wrap items-center gap-3">
              <AmberButton onClick={openPanel}>
                <span aria-hidden>⊞</span> Abrir o painel
              </AmberButton>
              <button
                onClick={scrollToFeatures}
                className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-6 py-3 text-base font-medium text-fg transition-colors hover:border-fg-subtle hover:bg-raised"
              >
                Como funciona
              </button>
            </m.div>
          </m.div>

          <m.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}>
            <HeroFrame />
          </m.div>
        </div>
      </section>

      {/* Painel-exemplo interativo (o PropsTableTerminal real com dados de amostra) */}
      <section className="landing-matte relative border-t border-border bg-surface/20">
        <div className="mx-auto max-w-[1200px] px-5 py-20 md:px-8 md:py-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-3 font-mono text-xs tracking-[0.28em] text-accent uppercase">O painel por dentro</div>
              <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Um terminal de props, ao vivo</h2>
              <p className="mt-3 max-w-xl text-fg-muted">
                Exemplo interativo — ordene pelas colunas, expanda uma linha, favorite. Mexa à vontade.
              </p>
            </div>
            <AmberButton onClick={openPanel}>
              <span aria-hidden>⊞</span> Abrir o painel completo
            </AmberButton>
          </div>
          <ExamplePanel />
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="landing-matte alt scroll-mt-20 border-t border-border bg-surface/40">
        <div className="mx-auto max-w-[1200px] px-5 py-20 md:px-8 md:py-28">
          <div className="mb-14 text-center">
            <div className="mb-3 font-mono text-xs tracking-[0.28em] text-accent uppercase">Recursos</div>
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">Tudo que você precisa para achar valor</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-fg-muted">Da odd crua ao stake sugerido, sem sair de um único painel.</p>
          </div>

          <m.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} f={f} />
            ))}
          </m.div>
        </div>
      </section>

      {/* CTA band */}
      <section className="landing-matte relative overflow-hidden border-t border-border">
        <m.div
          initial="rest"
          whileHover="hov"
          className="hero-frame group relative aspect-[21/9] w-full overflow-hidden border-y border-border-strong"
          style={{ background: "linear-gradient(135deg, var(--c-raised), var(--c-surface) 45%, var(--c-canvas))" }}
        >
          <m.img
            src="/landing-rayallen.jpg"
            alt="Arremesso decisivo nos playoffs"
            loading="lazy"
            decoding="async"
            variants={{ rest: { scale: 1 }, hov: { scale: 1.08 } }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="absolute inset-0 h-full w-full object-cover brightness-[.5] saturate-[.9]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/55 to-canvas/40" aria-hidden />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">Pronto para achar sua próxima entrada?</h2>
            <p className="mx-auto mt-4 max-w-md text-base text-fg-muted md:text-lg">
              Os jogos de hoje já estão analisados. Sem cadastro, sem burocracia.
            </p>
            <AmberButton onClick={openPanel} className="mt-8">
              <span aria-hidden>⊞</span> Abrir o painel
            </AmberButton>
          </div>
        </m.div>
      </section>

      {/* Footer */}
      <footer className="landing-matte border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="max-w-md">
            <Logo className="mb-2.5" />
            <p className="text-sm text-fg-subtle">
              Aposte com matemática, não com palpite. EV%, Kelly e rating por prop em um único painel.
            </p>
          </div>
          <div className="font-mono text-xs text-fg-subtle">© 2026 NBA Scout · EV Analyzer</div>
        </div>
      </footer>
    </div>
  );
}
