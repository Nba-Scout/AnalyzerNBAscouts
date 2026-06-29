// Contrato da API — espelha backend/app/routers/props.py::_row_to_out (28 campos)
// e PlayerDetailOut (backend/app/schemas/player.py). NÃO alterar sem alinhar o backend.

export type Rating = "STRONG" | "VALUE" | "NEUTRAL" | "AVOID";
export type Direction = "OVER" | "UNDER";

export interface AllOdd {
  bookmaker: string;
  odd: number;
}
export interface TeamInjury {
  name: string;
  status: string;
}
export interface Last5Value {
  value: number;
  hit: boolean;
}

/** Uma prop analisada — os 28 campos que o frontend consome. */
export interface Prop {
  player_name: string;
  team: string;
  game: string; // "vs LAL"
  market: string; // PTS, REB, PRA, ...
  line: number;
  direction: Direction | string;
  odd: number;
  prob_real: number; // 0..1 (decimal, não %)
  ev_pct: number; // já ×100
  kelly_pct: number; // já ×100
  kelly_full_pct: number; // já ×100 (×4)
  rating: Rating | string;
  bookmaker: string;
  games_over_line_pct: number; // 0..1
  all_odds: AllOdd[];
  team_injuries: TeamInjury[];
  dvp_rank: number;
  dvp_total: number;
  line_movement: number;
  line_opened: number;
  projected_min: number | null;
  min_boost_pct: number;
  last5_values: Last5Value[];
  avg_stat_last10: number;
  def_rating_opponent: number;
  pace: number;
  implied_prob: number;
  minutes_avg: number;
}

export interface PropsResponse {
  props: Prop[];
  generated_at: string;
  from_cache: boolean;
  demo_mode: boolean;
  quota_remaining: number;
  quota_limit: number;
}

export interface RecentGame {
  date: string;
  opp: string;
  home_away: string; // "home" | "away" | ""
  min: number;
  pts: number;
  reb: number;
  ast: number;
  fg3m: number;
  blk: number;
  stl: number;
  is_playoff: boolean;
  margin: number;
  team_score: number;
  opp_score: number;
}

export interface PlayerAverages {
  PTS: number;
  REB: number;
  AST: number;
  PRA: number;
  PR: number;
  PA: number;
  FG3M: number;
  STOCKS: number;
}

export interface PlayoffHistory {
  seasons: string[];
  games_count: number;
  avg_pts: number;
  avg_reb: number;
  avg_ast: number;
}

/** Splits casa/fora — chaves espelham player_detail.py (backend). */
export interface HomeAwaySplits {
  home_games: number;
  home_avg_pts: number;
  home_avg_reb: number;
  home_avg_ast: number;
  away_games: number;
  away_avg_pts: number;
  away_avg_reb: number;
  away_avg_ast: number;
}

export interface PlayerDetail {
  id: number;
  name: string;
  team: string;
  teamAbbr: string;
  position: string;
  height: string;
  age: string;
  home_away_splits: HomeAwaySplits;
  averages: PlayerAverages;
  spark: number[];
  recent_games: RecentGame[];
  playoff_history: PlayoffHistory;
}

export interface StatusResponse {
  is_refreshing: boolean;
  cached_at: string | null;
  next_refresh_in: number | null;
  quota_remaining: number;
  warehouse_last_sync: string | null;
}

export interface RefreshResponse {
  queued: boolean;
  message: string;
}

export interface Bet {
  id: number;
  player_name: string;
  market_key: string;
  line: number;
  direction: string;
  odd_decimal: number;
  ev_pct: number;
  kelly_pct: number;
  stake: number;
  status: string;
  result: string | null;
  profit_loss: number | null;
  added_at: string;
  settled_at: string | null;
}
