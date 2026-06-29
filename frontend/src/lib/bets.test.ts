import { describe, expect, it } from "vitest";

import type { Bet } from "../types/api";
import { bankrollSeries, computeWallet, isPending } from "./bets";

function bet(p: Partial<Bet>): Bet {
  return {
    id: 1,
    player_name: "Jokic",
    market_key: "PTS",
    line: 26.5,
    direction: "OVER",
    odd_decimal: 2.0,
    ev_pct: 8,
    kelly_pct: 5,
    stake: 100,
    status: "pending",
    result: null,
    profit_loss: null,
    added_at: "2026-06-01T12:00:00Z",
    settled_at: null,
    ...p,
  };
}

describe("isPending", () => {
  it("é pendente quando result é null", () => {
    expect(isPending(bet({ result: null }))).toBe(true);
    expect(isPending(bet({ result: "win" }))).toBe(false);
  });
});

describe("computeWallet", () => {
  it("carteira vazia → tudo zero", () => {
    const w = computeWallet([]);
    expect(w.total).toBe(0);
    expect(w.pnl).toBe(0);
    expect(w.roi).toBe(0);
    expect(w.hitRate).toBe(0);
  });

  it("conta pendentes, exposição e stakes", () => {
    const w = computeWallet([bet({ id: 1, stake: 100, result: null }), bet({ id: 2, stake: 50, result: null })]);
    expect(w.pending).toBe(2);
    expect(w.settled).toBe(0);
    expect(w.pendingStake).toBe(150);
    expect(w.stakedTotal).toBe(150);
    expect(w.stakedSettled).toBe(0);
  });

  it("agrega P&L, ROI e hit-rate das liquidadas (push não conta no hit-rate)", () => {
    const w = computeWallet([
      bet({ id: 1, stake: 100, result: "win", profit_loss: 100 }), // +100
      bet({ id: 2, stake: 100, result: "loss", profit_loss: -100 }), // -100
      bet({ id: 3, stake: 100, result: "win", profit_loss: 90 }), // +90
      bet({ id: 4, stake: 100, result: "push", profit_loss: 0 }), // 0
      bet({ id: 5, stake: 100, result: null }), // pendente
    ]);
    expect(w.total).toBe(5);
    expect(w.settled).toBe(4);
    expect(w.pending).toBe(1);
    expect(w.won).toBe(2);
    expect(w.lost).toBe(1);
    expect(w.pushed).toBe(1);
    expect(w.pnl).toBe(90); // 100-100+90+0
    expect(w.stakedSettled).toBe(400);
    expect(w.roi).toBe(22.5); // 90/400*100
    expect(w.hitRate).toBeCloseTo(66.67, 1); // 2/(2+1)
  });
});

describe("bankrollSeries", () => {
  it("começa no valor inicial e acumula em ordem de liquidação", () => {
    const series = bankrollSeries(
      [
        bet({ id: 1, result: "win", profit_loss: 100, settled_at: "2026-06-02T00:00:00Z" }),
        bet({ id: 2, result: "loss", profit_loss: -40, settled_at: "2026-06-03T00:00:00Z" }),
        bet({ id: 3, result: null }), // pendente — ignorada
      ],
      1000,
    );
    expect(series).toEqual([1000, 1100, 1060]);
  });

  it("ordena por settled_at independente da ordem de entrada", () => {
    const series = bankrollSeries(
      [
        bet({ id: 1, result: "loss", profit_loss: -50, settled_at: "2026-06-05T00:00:00Z" }),
        bet({ id: 2, result: "win", profit_loss: 200, settled_at: "2026-06-01T00:00:00Z" }),
      ],
      0,
    );
    expect(series).toEqual([0, 200, 150]);
  });
});
