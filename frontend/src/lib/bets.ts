// Cálculos puros da carteira de apostas (bet tracker). Sem dependência de React —
// fáceis de testar. P&L vem do backend (profit_loss); aqui só agregamos.

import type { Bet } from "../types/api";

export interface WalletStats {
  total: number;
  pending: number;
  settled: number;
  won: number;
  lost: number;
  pushed: number;
  /** Soma de todos os stakes (inclui pendentes). */
  stakedTotal: number;
  /** Soma dos stakes já liquidados (win+loss+push). */
  stakedSettled: number;
  /** Exposição em aberto (stakes pendentes). */
  pendingStake: number;
  /** Lucro/prejuízo realizado (soma de profit_loss). */
  pnl: number;
  /** ROI sobre o que foi liquidado, em %. 0 se nada liquidado. */
  roi: number;
  /** Taxa de acerto, em %: won / (won + lost). Push não conta. 0 se nada decidido. */
  hitRate: number;
}

/** Uma aposta é pendente quando ainda não tem resultado. */
export function isPending(b: Bet): boolean {
  return b.result == null;
}

export function computeWallet(bets: Bet[]): WalletStats {
  const s: WalletStats = {
    total: bets.length,
    pending: 0,
    settled: 0,
    won: 0,
    lost: 0,
    pushed: 0,
    stakedTotal: 0,
    stakedSettled: 0,
    pendingStake: 0,
    pnl: 0,
    roi: 0,
    hitRate: 0,
  };

  for (const b of bets) {
    const stake = b.stake || 0;
    s.stakedTotal += stake;
    if (isPending(b)) {
      s.pending += 1;
      s.pendingStake += stake;
      continue;
    }
    s.settled += 1;
    s.stakedSettled += stake;
    s.pnl += b.profit_loss ?? 0;
    if (b.result === "win") s.won += 1;
    else if (b.result === "loss") s.lost += 1;
    else if (b.result === "push") s.pushed += 1;
  }

  const decided = s.won + s.lost;
  s.roi = s.stakedSettled > 0 ? round2((s.pnl / s.stakedSettled) * 100) : 0;
  s.hitRate = decided > 0 ? round2((s.won / decided) * 100) : 0;
  s.pnl = round2(s.pnl);
  s.stakedTotal = round2(s.stakedTotal);
  s.stakedSettled = round2(s.stakedSettled);
  s.pendingStake = round2(s.pendingStake);
  return s;
}

/**
 * Série de bankroll acumulado a partir das apostas liquidadas, em ordem de
 * liquidação (settled_at asc). Começa em `starting` e soma cada profit_loss.
 * Retorna [starting, ...pontos] para alimentar o Sparkline.
 */
export function bankrollSeries(bets: Bet[], starting = 0): number[] {
  const settled = bets
    .filter((b) => !isPending(b))
    .slice()
    .sort((a, b) => settledTime(a) - settledTime(b));
  const series = [round2(starting)];
  let acc = starting;
  for (const b of settled) {
    acc += b.profit_loss ?? 0;
    series.push(round2(acc));
  }
  return series;
}

function settledTime(b: Bet): number {
  const t = b.settled_at ? Date.parse(b.settled_at) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
