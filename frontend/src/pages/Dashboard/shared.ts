// Helpers e tipos compartilhados pelas variações do dashboard.
// Sem componentes (arquivo .ts) — evita warning de react-refresh ao exportar
// funções utilitárias ao lado de componentes.

import type { CSSProperties } from "react";

import { KELLY_DIVISORS, type KellyMode, type OddMode } from "../../lib/format";
import type { Prop } from "../../types/api";

/** Cor do EV% em 4 faixas (migrado verbatim do legado). */
export function evColor(ev: number): string {
  if (ev >= 8) return "#4ade80";
  if (ev > 0) return "#86efac";
  if (ev > -1) return "#cbd5e1";
  return "#fca5a5";
}

/** Cor do hit rate (0..1): ≥60% verde · 40-60% amarelo · <40% vermelho. */
export function hitColor(pct: number): string {
  if (pct >= 0.6) return "#4ade80";
  if (pct >= 0.4) return "#fde047";
  return "#fca5a5";
}

/** Stake sugerida em R$ a partir do bankroll e do Kelly cheio (%), pelo modo escolhido. */
export function kellyStake(bankroll: number, kellyFullPct: number, mode: KellyMode): number {
  const div = KELLY_DIVISORS[mode] || 4;
  return Math.round((bankroll * kellyFullPct) / div / 100);
}

/** Estilo dos botões de paginação (Anterior/Próxima). */
export function pageBtnStyle(disabled: boolean): CSSProperties {
  return {
    padding: "5px 12px",
    background: disabled ? "transparent" : "#1a1a23",
    border: "1px solid #2a2a38",
    borderRadius: 4,
    color: disabled ? "#3a3a4a" : "#cbd5e1",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    cursor: disabled ? "default" : "pointer",
  };
}

/** Props comuns a todas as variações de visualização. */
export interface ViewProps {
  props: Prop[];
  onPlayer: (name: string) => void;
  oddMode: OddMode;
  kellyMode: KellyMode;
  bankroll?: number;
}

/** Handlers de ordenação (variações terminal/editorial). */
export interface SortHandlers {
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
}
