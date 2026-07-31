// Dataset de amostra p/ o painel-exemplo da landing (estático → funciona sem
// backend). Espelha o contrato Prop; valores plausíveis, sem ser dados reais.

import type { Prop } from "../../types/api";

type Seed = Pick<
  Prop,
  "player_name" | "team" | "game" | "market" | "market_key" | "line" | "direction" | "odd" | "ev_pct" | "games_over_line_pct" | "rating"
> &
  Partial<Prop>;

function mk(s: Seed): Prop {
  const l = s.line;
  return {
    prob_real: 0.6,
    kelly_pct: Math.max(0, s.ev_pct / 4),
    kelly_full_pct: Math.max(0, s.ev_pct),
    bookmaker: s.bookmaker ?? "draftkings",
    all_odds: s.all_odds ?? [
      { bookmaker: "draftkings", odd: s.odd },
      { bookmaker: "fanduel", odd: +(s.odd - 0.04).toFixed(2) },
      { bookmaker: "bet365", odd: +(s.odd - 0.06).toFixed(2) },
    ],
    team_injuries: [],
    dvp_rank: 12,
    dvp_total: 30,
    line_movement: s.line_movement ?? 0,
    line_opened: s.line_opened ?? l,
    projected_min: 34,
    min_boost_pct: 0,
    last5_values: s.last5_values ?? [
      { value: l + 2, hit: true },
      { value: l - 1, hit: false },
      { value: l + 3, hit: true },
      { value: l + 1, hit: true },
      { value: l - 2, hit: false },
    ],
    avg_stat_last10: l + 1,
    def_rating_opponent: 112,
    pace: 100,
    implied_prob: +(1 / s.odd).toFixed(3),
    minutes_avg: 34,
    ...s,
  };
}

export const SAMPLE_PROPS: Prop[] = [
  mk({ player_name: "Nikola Jokić", team: "DEN", game: "vs MIN", market: "PRA", market_key: "player_points_rebounds_assists", line: 56.5, direction: "OVER", odd: 1.87, ev_pct: 12.9, games_over_line_pct: 0.71, rating: "STRONG", line_movement: 1 }),
  mk({ player_name: "LeBron James", team: "LAL", game: "vs PHX", market: "STOCKS", market_key: "player_blocks_steals", line: 2.5, direction: "OVER", odd: 2.01, ev_pct: 13.1, games_over_line_pct: 0.66, rating: "STRONG" }),
  mk({ player_name: "Jayson Tatum", team: "BOS", game: "vs MIL", market: "REB", market_key: "player_rebounds", line: 8.5, direction: "OVER", odd: 1.95, ev_pct: 11.8, games_over_line_pct: 0.54, rating: "STRONG", line_movement: -0.5 }),
  mk({ player_name: "Anthony Edwards", team: "MIN", game: "vs DEN", market: "PTS", market_key: "player_points", line: 26.5, direction: "OVER", odd: 1.83, ev_pct: 6.6, games_over_line_pct: 0.69, rating: "VALUE" }),
  mk({ player_name: "Luka Dončić", team: "DAL", game: "vs OKC", market: "AST", market_key: "player_assists", line: 8.5, direction: "UNDER", odd: 1.95, ev_pct: 4.4, games_over_line_pct: 0.43, rating: "VALUE" }),
  mk({ player_name: "Shai Gilgeous-Alexander", team: "OKC", game: "vs DAL", market: "PTS", market_key: "player_points", line: 30.5, direction: "OVER", odd: 1.9, ev_pct: 8.2, games_over_line_pct: 0.62, rating: "STRONG", line_movement: 0.5 }),
];
