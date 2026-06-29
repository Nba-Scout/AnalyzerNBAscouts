// Helpers de cor por métrica — app-wide (usados pelo Dashboard e pela página Player).
// Migrados verbatim do legado; ficam em lib/ porque não são específicos de uma página.

/** Cor do EV% em 4 faixas: ≥8 verde forte · >0 verde claro · >-1 cinza · resto vermelho. */
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
