// Export CSV — migrado de static/dashboard.jsx::exportCsv.
// Separado em toCsv (puro, testável) + exportCsv (dispara o download no browser).

import type { Prop } from "../types/api";

const HEADERS = [
  "Jogador",
  "Time",
  "Jogo",
  "Mercado",
  "Linha",
  "Direção",
  "Odd",
  "Prob Real",
  "EV%",
  "Kelly%",
  "Hit%",
  "Rating",
  "Casa",
];

const esc = (v: unknown): string => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Gera o conteúdo CSV (string) a partir das props. Puro — testável sem DOM. */
export function toCsv(props: Prop[]): string {
  const rows = props.map((p) =>
    [
      p.player_name,
      p.team,
      p.game,
      p.market,
      p.line,
      p.direction,
      p.odd.toFixed(2),
      (p.prob_real * 100).toFixed(1) + "%",
      p.ev_pct.toFixed(2) + "%",
      p.kelly_pct.toFixed(2) + "%",
      p.games_over_line_pct != null ? (p.games_over_line_pct * 100).toFixed(0) + "%" : "—",
      p.rating,
      p.bookmaker,
    ]
      .map(esc)
      .join(","),
  );
  return [HEADERS.join(","), ...rows].join("\n");
}

/** Dispara o download do CSV no browser (BOM + filename datado). */
export function exportCsv(props: Prop[], today: string = new Date().toISOString().slice(0, 10)): void {
  const csv = toCsv(props);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nba-props-${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
