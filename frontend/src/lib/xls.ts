// Export para Excel (.xls) — substitui o CSV, que abria tudo na coluna A no
// Excel pt-BR (separador ';' vs ','). Gera uma tabela HTML que o Excel importa
// em colunas de verdade, em qualquer locale. Header em âmbar (design system).
// `mso-number-format:"\@"` força texto → sem mangle de data/decimal por locale.
//
// Nota: isto é um .xls "HTML" (sem dependência). Um .xlsx nativo com células
// tipadas (números somáveis) é o próximo passo — ver docs/PLANO_ARQUITETURA_PROFISSIONAL.

import type { Bet, Prop } from "../types/api";

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

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function rowValues(p: Prop): (string | number)[] {
  return [
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
    p.games_over_line_pct != null ? (p.games_over_line_pct * 100).toFixed(0) + "%" : "-",
    p.rating,
    p.bookmaker,
  ];
}

/** Monta o HTML da planilha (.xls) a partir de cabeçalhos + linhas. Puro. */
function buildXlsHtml(sheet: string, headers: string[], rows: (string | number)[][]): string {
  const head = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>`;
  const body = rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("");
  return (
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8">` +
    `<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>` +
    `<x:Name>${esc(sheet)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>` +
    `</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->` +
    `<style>table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt}` +
    `th,td{border:1px solid #d0d0d0;padding:4px 8px;mso-number-format:"\\@";white-space:nowrap}` +
    `th{background:#f59e0b;color:#111827;font-weight:bold;text-align:left}</style></head>` +
    `<body><table>${head}${body}</table></body></html>`
  );
}

function download(html: string, filename: string): void {
  const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Gera o HTML da planilha de props (.xls). Puro — testável sem DOM. */
export function toXlsHtml(props: Prop[]): string {
  return buildXlsHtml("NBA Props", HEADERS, props.map(rowValues));
}

/** Dispara o download do .xls de props (BOM + filename datado). */
export function exportXls(props: Prop[], today: string = new Date().toISOString().slice(0, 10)): void {
  download(toXlsHtml(props), `nba-props-${today}.xls`);
}

const BET_HEADERS = ["Jogador", "Mercado", "Linha", "Direção", "Odd", "Stake", "Status", "Resultado", "P&L", "Data"];

function betRow(b: Bet): (string | number)[] {
  const settled = b.result != null;
  return [
    b.player_name,
    b.market_key,
    b.line,
    b.direction,
    b.odd_decimal.toFixed(2),
    b.stake.toFixed(2),
    settled ? "Liquidada" : "Pendente",
    b.result ?? "-",
    b.profit_loss != null ? b.profit_loss.toFixed(2) : "-",
    (b.settled_at ?? b.added_at ?? "").slice(0, 10),
  ];
}

/** Gera o HTML da planilha da carteira (.xls). Puro. */
export function toBetsXlsHtml(bets: Bet[]): string {
  return buildXlsHtml("Carteira", BET_HEADERS, bets.map(betRow));
}

/** Dispara o download do .xls da carteira. */
export function exportBetsXls(bets: Bet[], today: string = new Date().toISOString().slice(0, 10)): void {
  download(toBetsXlsHtml(bets), `nba-carteira-${today}.xls`);
}
