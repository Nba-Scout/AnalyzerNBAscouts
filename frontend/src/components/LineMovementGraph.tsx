// Line Movement Graph — série temporal da linha de uma prop (movimento intraday).
// SVG puro, tokenizado e theme-aware. Consome /api/line-history via useLineHistory.
// Regra de cor do design system: verde/vermelho = sinal (aqui, direção do movimento
// da linha = sharp money); âmbar fica para o traço neutro do gráfico.

import { useLineHistory } from "../api/queries";
import { cn } from "../lib/cn";
import type { LineHistoryPoint } from "../types/api";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Chart({ points }: { points: LineHistoryPoint[] }) {
  const W = 240;
  const H = 72;
  const padX = 8;
  const padY = 12;

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
    <div className="flex-shrink-0">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[9.5px] tracking-wide text-fg-subtle uppercase">Movimento da linha</span>
        <span className={cn("font-mono text-[10px] font-semibold tabular-nums", deltaClass)}>{deltaLabel}</span>
      </div>
      <svg width={W} height={H} className="text-accent" role="img" aria-label="Gráfico de movimento da linha">
        <defs>
          <linearGradient id="lmg-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {n > 1 && <path d={area} fill="url(#lmg-fill)" stroke="none" />}
        {n > 1 && <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.line)} r={i === n - 1 ? 3 : 2} fill="currentColor" />
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
}: {
  player: string;
  marketKey: string;
  direction: string;
  active: boolean;
}) {
  const { data, isLoading } = useLineHistory(player, marketKey, direction, active);
  const points = data?.points ?? [];

  if (!active) return null;
  if (isLoading) {
    return <div className="font-mono text-[10px] text-fg-subtle">Carregando movimento…</div>;
  }
  if (points.length < 2) {
    return (
      <div className="font-mono text-[10px] text-fg-subtle">
        {points.length === 1 ? "Só 1 leitura da linha até agora." : "Sem histórico de movimento ainda."}
      </div>
    );
  }
  return <Chart points={points} />;
}
