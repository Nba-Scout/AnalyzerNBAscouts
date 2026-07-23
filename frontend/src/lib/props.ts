// Funções puras de props — migradas de static/dashboard.jsx + favorites.jsx.

import type { Prop } from "../types/api";

export interface Filters {
  market: string;
  minEv: number;
  onlyStrong: boolean;
  game: string;
  team: string;
  search: string;
  sortBy: string;
  sortDir: "asc" | "desc";
}

export const DEFAULT_FILTERS: Filters = {
  market: "ALL",
  minEv: 3,
  onlyStrong: false,
  game: "ALL",
  team: "ALL",
  search: "",
  sortBy: "ev_pct",
  sortDir: "desc",
};

/** Chave canônica de jogo a partir de uma prop: "A vs B" (ordenado). */
export function gameKey(prop: Prop): string {
  const opp = (prop.game || "").replace(/^vs\s*/i, "").trim();
  const parts = [prop.team, opp].filter(Boolean).sort();
  return parts.length === 2 ? parts.join(" vs ") : "";
}

/** Extrai as siglas de um gameKey "CLE vs BOS". */
export function teamsFromGame(key: string): string[] {
  return key
    .split(/\s+vs\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Time do jogador — usa prop.team; senão deriva do gameKey. */
export function playerTeam(prop: Prop): string {
  if (prop.team) return prop.team;
  const opp = (prop.game || "").replace(/^vs\s*/i, "").trim();
  const gk = gameKey(prop);
  if (!gk || !opp) return "";
  const parts = gk.split(" vs ");
  return parts.find((t) => t !== opp) || "";
}

type FilterArgs = Pick<Filters, "market" | "minEv" | "onlyStrong" | "game" | "team" | "search">;

export function applyFilters(props: Prop[], { market, minEv, onlyStrong, game, team, search }: FilterArgs): Prop[] {
  const q = (search || "").trim().toLowerCase();
  return props.filter((p) => {
    if (market !== "ALL" && p.market !== market) return false;
    if (p.ev_pct < minEv) return false;
    if (onlyStrong && p.rating !== "STRONG") return false;
    if (game && game !== "ALL" && gameKey(p) !== game) return false;
    if (team && team !== "ALL" && playerTeam(p) !== team) return false;
    if (q && !p.player_name.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function applySort(props: Prop[], { sortBy, sortDir }: Pick<Filters, "sortBy" | "sortDir">): Prop[] {
  if (!sortBy) return props;
  return [...props].sort((a, b) => {
    const av = a[sortBy as keyof Prop] as number | string;
    const bv = b[sortBy as keyof Prop] as number | string;
    if (typeof av === "string") {
      return sortDir === "desc" ? (bv as string).localeCompare(av) : av.localeCompare(bv as string);
    }
    const an = (av as number) ?? (sortDir === "desc" ? -Infinity : Infinity);
    const bn = (bv as number) ?? (sortDir === "desc" ? -Infinity : Infinity);
    return sortDir === "desc" ? bn - an : an - bn;
  });
}

export interface Metrics {
  total: number;
  evPositiveCount: number;
  strong: number;
  avgEv: number;
}

export function computeMetrics(props: Prop[]): Metrics {
  const total = props.length;
  const evPositive = props.filter((p) => p.ev_pct > 0);
  const strong = props.filter((p) => p.rating === "STRONG").length;
  const avgEv = evPositive.length ? evPositive.reduce((s, p) => s + p.ev_pct, 0) / evPositive.length : 0;
  return { total, evPositiveCount: evPositive.length, strong, avgEv };
}

/** Chave de favorito — migrada de static/favorites.jsx::propKey. */
export function propKey(prop: Pick<Prop, "player_name" | "market" | "line" | "direction">): string {
  return `${prop.player_name}|${prop.market}|${prop.line}|${prop.direction}`;
}
