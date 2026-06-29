// Helpers e tipos compartilhados pelas variações do dashboard.
// Sem componentes (arquivo .ts) — evita warning de react-refresh ao exportar
// funções utilitárias ao lado de componentes.

import { KELLY_DIVISORS, type KellyMode, type OddMode } from "../../lib/format";
import type { Prop } from "../../types/api";

/** Stake sugerida em R$ a partir do bankroll e do Kelly cheio (%), pelo modo escolhido. */
export function kellyStake(bankroll: number, kellyFullPct: number, mode: KellyMode): number {
  const div = KELLY_DIVISORS[mode] || 4;
  return Math.round((bankroll * kellyFullPct) / div / 100);
}

/** Classe Tailwind de bg para a barra de accent por rating (token, theme-aware). */
export function ratingAccentClass(rating: string): string {
  const map: Record<string, string> = { STRONG: "bg-ev-strong", VALUE: "bg-info", NEUTRAL: "bg-fg-subtle", AVOID: "bg-ev-neg" };
  return map[rating] ?? "bg-fg-subtle";
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

/** Variants de stagger reutilizáveis (Framer Motion) p/ listas/grids. */
export const listStagger = { hidden: {}, show: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } } };
export const listItem = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
