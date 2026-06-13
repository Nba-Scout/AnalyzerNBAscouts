// Formatadores — migrados verbatim de static/atoms.jsx (lógica preservada).

export type OddMode = "decimal" | "implied";
export type KellyMode = "full" | "half" | "quarter" | "eighth";

export function fmtOdd(o: number, mode?: OddMode): string {
  if (mode === "implied") return `${(100 / o).toFixed(1)}%`;
  return o.toFixed(2);
}

export function fmtPct(v: number, digits = 1): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export function fmtProb(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export const KELLY_DIVISORS: Record<KellyMode, number> = {
  full: 1,
  half: 2,
  quarter: 4,
  eighth: 8,
};

export function fmtKelly(fullPct: number, mode: KellyMode): string {
  const d = KELLY_DIVISORS[mode] || 4;
  return `${(fullPct / d).toFixed(1)}%`;
}

/** Normaliza EV% (-5..15) → 0..1 para o Gauge. */
export function normEv(ev: number): number {
  return Math.max(0, Math.min(1, (ev + 5) / 20));
}
