// Card de média com sparkline — tokenizado (Etapa 4). A cor por estatística é uma
// paleta de data-viz fixa (identidade da métrica); o resto é token (theme-aware).

import { Sparkline } from "../../components/atoms";

const STAT_COLORS: Record<string, string> = {
  PTS: "var(--c-accent)",
  REB: "var(--c-ev-strong)",
  AST: "var(--c-info)",
  PRA: "#8b5cf6",
  "P+R": "#3b82f6",
  "P+A": "#06b6d4",
  "3PM": "#ec4899",
  STOCKS: "#f97316",
};

export function AvgCard({ label, value, sub, spark }: { label: string; value: number; sub?: string; spark?: number[] }) {
  const color = STAT_COLORS[label] || "var(--c-accent)";
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-3.5 transition-colors hover:border-border-strong">
      <div className="absolute inset-y-0 left-0 w-0.5 opacity-60" style={{ background: color }} />
      <div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-fg-subtle">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="font-mono text-[23px] font-bold leading-none tracking-tight text-fg tabular-nums">{value.toFixed(1)}</div>
        {spark && spark.length > 0 && <Sparkline data={spark} color={color} w={52} h={20} />}
      </div>
      {sub && <div className="mt-1.5 font-mono text-[9.5px] text-fg-subtle">{sub}</div>}
    </div>
  );
}
