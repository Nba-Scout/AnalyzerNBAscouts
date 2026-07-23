// Backtesting Panel — ROI histórico das props liquidadas contra o resultado
// real (data warehouse). Stake flat de 1u por prop. Tokenizado: verde/vermelho
// só p/ sinal (P&L/hit); âmbar = chrome/ação.

import { useState } from "react";

import { useBacktest } from "../../api/queries";
import { SectionLabel } from "../../components/SectionLabel";
import { ThemeToggle } from "../../components/ThemeToggle";
import { Button, EmptyState, Panel, Pill, Skeleton, Stat } from "../../components/ui";
import { cn } from "../../lib/cn";
import type { BacktestDay } from "../../types/api";

const RATINGS = [
  { key: "strong", label: "STRONG" },
  { key: "value", label: "VALUE" },
  { key: "all", label: "TODAS" },
];
const WINDOWS = [30, 90, 180, 365];

const signalClass = (n: number) => (n > 0 ? "text-signal-pos" : n < 0 ? "text-signal-neg" : "text-fg-muted");
const fmtU = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}u`;

/** Curva acumulada (u) — linha + área via currentColor; eixo zero tracejado. */
function CumulativeCurve({ series }: { series: BacktestDay[] }) {
  const W = 720;
  const H = 180;
  const padY = 10;
  if (series.length < 2) return null;

  const values = series.map((d) => d.cum_units);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const stepX = W / (series.length - 1);
  const y = (v: number) => padY + (H - 2 * padY) * (1 - (v - min) / span);

  const pts = series.map((d, i) => `${(i * stepX).toFixed(1)},${y(d.cum_units).toFixed(1)}`);
  const zeroY = y(0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full overflow-visible"
      role="img"
      aria-label="Curva acumulada do backtest"
    >
      <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="var(--c-border-strong)" strokeDasharray="4 4" strokeWidth={1} />
      <path d={`M 0,${zeroY} L ${pts.join(" L ")} L ${W},${zeroY} Z`} fill="currentColor" fillOpacity={0.08} />
      <path d={`M ${pts.join(" L ")}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
      {series.map((d, i) => (
        <circle key={d.date} cx={i * stepX} cy={y(d.cum_units)} r={i === series.length - 1 ? 3 : 1.8} fill="currentColor">
          <title>{`${d.date}: ${fmtU(d.cum_units)} acumulado (${fmtU(d.pnl_units)} no dia)`}</title>
        </circle>
      ))}
    </svg>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const TH = "px-3 py-2 text-left font-mono text-[9.5px] uppercase tracking-[0.1em] text-fg-subtle";
const TD = "px-3 py-2 font-mono text-[12.5px] tabular-nums";

export function Backtest({ onBack }: { onBack: () => void }) {
  const [rating, setRating] = useState("strong");
  const [days, setDays] = useState(90);
  const { data, isLoading, isError, refetch } = useBacktest(rating, days);

  const s = data?.summary;
  const series = data?.series ?? [];
  const decided = (s?.wins ?? 0) + (s?.losses ?? 0);

  return (
    <div className="min-h-screen bg-canvas font-sans text-fg">
      <header className="sticky top-0 z-10 border-b border-border bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-3 md:px-7">
          <Button variant="outline" size="sm" onClick={onBack}>
            ← Voltar
          </Button>
          <div className="font-mono text-[10.5px] uppercase tracking-widest text-fg-subtle">NBA SCOUT / BACKTEST</div>
          <div className="ml-auto" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-7">
        <div>
          <h1 className="font-sans text-xl font-bold tracking-tight">Backtesting</h1>
          <p className="mt-1 font-sans text-[13px] text-fg-subtle">
            Desempenho real das props recomendadas, liquidadas contra o resultado dos jogos. Stake flat de 1u por prop.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface p-3.5">
          <span className="mr-0.5 font-mono text-[10.5px] uppercase tracking-wide text-fg-subtle">RATING</span>
          {RATINGS.map((r) => (
            <Pill key={r.key} active={rating === r.key} onClick={() => setRating(r.key)}>
              {r.label}
            </Pill>
          ))}
          <div className="mx-1 h-4 w-px flex-shrink-0 bg-border" />
          <span className="mr-0.5 font-mono text-[10.5px] uppercase tracking-wide text-fg-subtle">JANELA</span>
          {WINDOWS.map((w) => (
            <Pill key={w} active={days === w} onClick={() => setDays(w)}>
              {w}d
            </Pill>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Não foi possível carregar o backtest"
            hint="O backend de /api/backtest está indisponível."
            action={
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Tentar de novo
              </Button>
            }
          />
        ) : !s || s.props === 0 ? (
          <EmptyState
            title="Nenhuma prop liquidada ainda"
            hint="A liquidação roda todo dia após o sync do data warehouse: cada prop analisada é comparada com o stat real do jogador. Volte depois do próximo ciclo de análise."
          />
        ) : (
          <>
            {/* Resumo */}
            <Panel className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Props liquidadas" value={s.props} sub={s.pending > 0 ? `${s.pending} pendentes` : "tudo liquidado"} />
              <Stat
                label="Hit rate"
                value={decided > 0 ? `${s.hit_rate.toFixed(0)}%` : "—"}
                accentClass={
                  s.hit_rate >= 55 ? "text-signal-pos" : s.hit_rate < 45 && decided > 0 ? "text-signal-neg" : "text-fg"
                }
                sub={`${s.wins}W · ${s.losses}L${s.pushes ? ` · ${s.pushes}P` : ""}`}
              />
              <Stat label="P&L" value={fmtU(s.pnl_units)} accentClass={signalClass(s.pnl_units)} sub="stake flat 1u" />
              <Stat
                label="ROI"
                value={`${s.roi_pct > 0 ? "+" : ""}${s.roi_pct.toFixed(1)}%`}
                accentClass={signalClass(s.roi_pct)}
                sub="sobre o apostado"
              />
              <Stat label="Odd média" value={s.avg_odd.toFixed(2)} />
              <Stat label="Voids" value={s.voids} sub="jogador não jogou" />
            </Panel>

            {/* Curva */}
            {series.length >= 2 && (
              <section className="flex flex-col gap-2.5">
                <SectionLabel>Curva acumulada (unidades)</SectionLabel>
                <Panel className={cn("overflow-x-auto", signalClass(s.pnl_units))}>
                  <CumulativeCurve series={series} />
                </Panel>
              </section>
            )}

            {/* Por dia */}
            <section className="flex flex-col gap-2.5">
              <SectionLabel>Por dia</SectionLabel>
              <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={TH}>Data</th>
                      <th className={cn(TH, "text-right")}>Props</th>
                      <th className={cn(TH, "text-right")}>W</th>
                      <th className={cn(TH, "text-right")}>L</th>
                      <th className={cn(TH, "text-right")}>P</th>
                      <th className={cn(TH, "text-right")}>P&L dia</th>
                      <th className={cn(TH, "text-right")}>Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series
                      .slice()
                      .reverse()
                      .map((d) => (
                        <tr key={d.date} className="border-b border-border/60 last:border-0">
                          <td className={cn(TD, "text-fg-muted")}>{fmtDate(d.date)}</td>
                          <td className={cn(TD, "text-right text-fg")}>{d.props}</td>
                          <td className={cn(TD, "text-right text-signal-pos")}>{d.wins}</td>
                          <td className={cn(TD, "text-right text-signal-neg")}>{d.losses}</td>
                          <td className={cn(TD, "text-right text-fg-subtle")}>{d.pushes}</td>
                          <td className={cn(TD, "text-right font-semibold", signalClass(d.pnl_units))}>{fmtU(d.pnl_units)}</td>
                          <td className={cn(TD, "text-right font-semibold", signalClass(d.cum_units))}>{fmtU(d.cum_units)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
