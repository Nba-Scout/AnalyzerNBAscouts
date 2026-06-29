// Helpers de cor por métrica — retornam CSS custom properties (tokens), então
// trocam com o tema automaticamente, inclusive em inline styles. App-wide
// (Dashboard + Player). As mesmas cores existem como utilitários Tailwind
// (text-ev-strong, text-hit-hi, ...) para os componentes já tokenizados.

/** Cor do EV% em 4 faixas: ≥8 forte · >0 positivo · >-1 neutro · resto negativo. */
export function evColor(ev: number): string {
  if (ev >= 8) return "var(--c-ev-strong)";
  if (ev > 0) return "var(--c-ev-pos)";
  if (ev > -1) return "var(--c-ev-neutral)";
  return "var(--c-ev-neg)";
}

/** Cor do hit rate (0..1): ≥60% alto · 40-60% médio · <40% baixo. */
export function hitColor(pct: number): string {
  if (pct >= 0.6) return "var(--c-hit-hi)";
  if (pct >= 0.4) return "var(--c-hit-mid)";
  return "var(--c-hit-lo)";
}

/** Classe Tailwind de texto p/ EV% (mesmas faixas de evColor). */
export function evColorClass(ev: number): string {
  if (ev >= 8) return "text-ev-strong";
  if (ev > 0) return "text-ev-pos";
  if (ev > -1) return "text-ev-neutral";
  return "text-ev-neg";
}

/** Classe Tailwind de texto p/ hit rate (mesmas faixas de hitColor). */
export function hitColorClass(pct: number): string {
  if (pct >= 0.6) return "text-hit-hi";
  if (pct >= 0.4) return "text-hit-mid";
  return "text-hit-lo";
}
