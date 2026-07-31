// Resumo da carteira: KPIs (P&L, ROI, acerto, exposição, banca) + curva de bankroll.

import { m } from "motion/react";

import { CountUp } from "../../components/atoms";
import { Panel, Stat } from "../../components/ui";
import { bankrollSeries, computeWallet } from "../../lib/bets";
import { cn } from "../../lib/cn";
import { fmtPct } from "../../lib/format";
import type { Bet } from "../../types/api";

function brl(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}R$ ${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** Mini curva de bankroll usando currentColor (theme-aware via classe do pai). */
function BankrollCurve({ series, w = 220, h = 56 }: { series: number[]; w?: number; h?: number }) {
  if (series.length < 2) {
    return <div className="font-mono text-[11px] text-fg-subtle">sem histórico liquidado ainda</div>;
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const stepX = w / (series.length - 1);
  const pts = series.map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`);
  const path = "M " + pts.join(" L ");
  const area = `M 0,${h} L ` + pts.join(" L ") + ` L ${w},${h} Z`;
  const last = series[series.length - 1];
  const lastY = h - ((last - min) / span) * h;
  return (
    <svg width={w} height={h} className="block overflow-visible" role="img" aria-label="Curva de bankroll">
      <m.path d={area} fill="currentColor" fillOpacity={0.1} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.25 }} />
      <m.path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />
      <m.circle
        cx={(series.length - 1) * stepX}
        cy={lastY}
        r={2.2}
        fill="currentColor"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.95, type: "spring", stiffness: 500, damping: 22 }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </svg>
  );
}

export function WalletSummary({ bets, bankroll }: { bets: Bet[]; bankroll: number }) {
  const w = computeWallet(bets);
  const series = bankrollSeries(bets, bankroll);
  const current = bankroll + w.pnl;
  const pnlClass = w.pnl > 0 ? "text-ev-strong" : w.pnl < 0 ? "text-ev-neg" : "text-fg";
  const roiClass = w.roi > 0 ? "text-ev-strong" : w.roi < 0 ? "text-ev-neg" : "text-fg";
  // muda ao liquidar/adicionar → KPIs recontam e a curva redesenha
  const replayKey = `${w.settled}-${w.pending}`;

  return (
    <Panel className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Banca"
          value={
            <CountUp
              value={current}
              replay={replayKey}
              format={(v) => `R$ ${Math.round(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
            />
          }
          sub={`inicial R$ ${bankroll.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
        />
        <Stat
          label="P&L"
          value={<CountUp value={w.pnl} replay={replayKey} format={brl} />}
          accentClass={pnlClass}
          sub={`${w.settled} liquidada${w.settled === 1 ? "" : "s"}`}
        />
        <Stat
          label="ROI"
          value={<CountUp value={w.roi} replay={replayKey} format={(v) => fmtPct(v)} />}
          accentClass={roiClass}
          sub="sobre o investido"
        />
        <Stat
          label="Acerto"
          value={
            w.won + w.lost > 0 ? (
              <CountUp value={w.hitRate} replay={replayKey} format={(v) => `${v.toFixed(0)}%`} />
            ) : (
              "—"
            )
          }
          sub={`${w.won}V · ${w.lost}D${w.pushed ? ` · ${w.pushed}P` : ""}`}
        />
        <Stat
          label="Em aberto"
          value={
            <CountUp
              value={w.pendingStake}
              replay={replayKey}
              format={(v) => `R$ ${Math.round(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
            />
          }
          sub={`${w.pending} pendente${w.pending === 1 ? "" : "s"}`}
        />
      </div>
      <div className={cn("flex flex-col items-start gap-1 lg:items-end", w.pnl < 0 ? "text-ev-neg" : "text-ev-strong")}>
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">Curva de bankroll</div>
        <BankrollCurve key={replayKey} series={series} />
      </div>
    </Panel>
  );
}
