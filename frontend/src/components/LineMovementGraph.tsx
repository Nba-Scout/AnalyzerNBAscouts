// Line Movement Graph — série temporal da linha de uma prop (movimento intraday).
// SVG puro, tokenizado e theme-aware. Consome /api/line-history via useLineHistory.
// Regra de cor do design system: verde/vermelho = sinal (aqui, direção do movimento
// da linha = sharp money); âmbar fica para o traço neutro do gráfico.

import { useId } from "react";
import { m } from "motion/react";

import { useLineHistory } from "../api/queries";
import { cn } from "../lib/cn";
import type { LineHistoryPoint } from "../types/api";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Chart({ points, fluid }: { points: LineHistoryPoint[]; fluid: boolean }) {
  const W = 240;
  const H = 72;
  const padX = 8;
  const padY = 12;

  // O id do gradiente precisa ser único por instância: nos cards há N gráficos
  // na mesma página, e ids duplicados fazem todos referenciarem o primeiro <defs>.
  // Sem os ":" do useId, que atrapalham o url(#…) do SVG.
  const gradientId = `lmg-${useId().replace(/:/g, "")}`;

  const lines = points.map((p) => p.line);
  const min = Math.min(...lines);
  const max = Math.max(...lines);
  const span = max - min || 1;

  const n = points.length;
  const x = (i: number) => padX + (n === 1 ? (W - 2 * padX) / 2 : (i * (W - 2 * padX)) / (n - 1));
  const y = (v: number) => padY + (H - 2 * padY) * (1 - (v - min) / span);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.line).toFixed(1)}`).join(" ");
  const area = `${path} L${x(n - 1).toFixed(1)},${(H - padY).toFixed(1)} L${x(0).toFixed(1)},${(H - padY).toFixed(1)} Z`;

  const delta = +(points[n - 1].line - points[0].line).toFixed(1);
  const deltaClass = delta > 0 ? "text-signal-pos" : delta < 0 ? "text-signal-neg" : "text-fg-subtle";
  const deltaLabel = delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "→ 0";

  return (
    <div className={fluid ? "w-full min-w-0" : "flex-shrink-0"}>
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[9.5px] tracking-wide text-fg-subtle uppercase">Movimento da linha</span>
        <span className={cn("font-mono text-[10px] font-semibold tabular-nums", deltaClass)}>{deltaLabel}</span>
      </div>
      {/* fluid: os cards têm largura variável por breakpoint, então o SVG escala
          pelo viewBox (uniforme — sem distorcer a espessura do traço). */}
      <svg
        {...(fluid
          ? { viewBox: `0 0 ${W} ${H}`, className: "h-auto w-full text-accent" }
          : { width: W, height: H, className: "text-accent" })}
        role="img"
        aria-label="Gráfico de movimento da linha"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* desenha ao montar (= ao abrir o accordion): área em fade, linha traçando,
            pontos pipocando em sequência. Respeita reduced-motion via MotionConfig. */}
        {n > 1 && (
          <m.path
            d={area}
            fill={`url(#${gradientId})`}
            stroke="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          />
        )}
        {n > 1 && (
          <m.path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
        {points.map((p, i) => (
          <m.circle
            key={i}
            cx={x(i)}
            cy={y(p.line)}
            r={i === n - 1 ? 3 : 2}
            fill="currentColor"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.55 + i * 0.05, type: "spring", stiffness: 520, damping: 24 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-fg-subtle tabular-nums">
        <span>
          {fmtTime(points[0].captured_at)} · {points[0].line}
        </span>
        <span>
          {fmtTime(points[n - 1].captured_at)} · {points[n - 1].line}
        </span>
      </div>
    </div>
  );
}

export function LineMovementGraph({
  player,
  marketKey,
  direction,
  active,
  variant = "panel",
}: {
  player: string;
  marketKey: string;
  direction: string;
  active: boolean;
  /** "panel" (padrão): largura fixa e placeholder de texto quando não há série —
   *  cabe no AccordionPanel, onde o gráfico é o conteúdo esperado.
   *  "card": largura fluida e NADA renderizado sem série (<2 pontos ou loading),
   *  porque nos cards o gráfico é opcional e um placeholder viraria ruído em N cards. */
  variant?: "panel" | "card";
}) {
  const { data, isLoading } = useLineHistory(player, marketKey, direction, active);
  const points = data?.points ?? [];
  const card = variant === "card";

  if (!active) return null;
  if (isLoading) {
    return card ? null : <div className="font-mono text-[10px] text-fg-subtle">Carregando movimento…</div>;
  }
  if (points.length < 2) {
    if (card) return null;
    return (
      <div className="font-mono text-[10px] text-fg-subtle">
        {points.length === 1 ? "Só 1 leitura da linha até agora." : "Sem histórico de movimento ainda."}
      </div>
    );
  }
  return <Chart points={points} fluid={card} />;
}
