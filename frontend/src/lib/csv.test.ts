import { describe, expect, it } from "vitest";

import type { Prop } from "../types/api";
import { toCsv } from "./csv";

function makeProp(over: Partial<Prop> = {}): Prop {
  return {
    player_name: "Nikola Jokic",
    team: "DEN",
    game: "vs LAL",
    market: "PTS",
    market_key: "player_points",
    line: 27.5,
    direction: "OVER",
    odd: 1.9,
    prob_real: 0.62,
    ev_pct: 18.42,
    kelly_pct: 5,
    kelly_full_pct: 20,
    rating: "STRONG",
    bookmaker: "pinnacle",
    games_over_line_pct: 0.7,
    all_odds: [],
    team_injuries: [],
    dvp_rank: 5,
    dvp_total: 30,
    line_movement: 0,
    line_opened: 27.5,
    projected_min: null,
    min_boost_pct: 0,
    last5_values: [],
    avg_stat_last10: 28,
    def_rating_opponent: 113,
    pace: 99,
    implied_prob: 0.52,
    minutes_avg: 34,
    ...over,
  };
}

describe("toCsv", () => {
  it("emits a header row + one row per prop", () => {
    const csv = toCsv([makeProp()]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Jogador");
    expect(lines[0]).toContain("Casa");
  });

  it("formats values like the legacy export", () => {
    const row = toCsv([makeProp()]).split("\n")[1];
    expect(row).toContain('"Nikola Jokic"');
    expect(row).toContain('"1.90"'); // odd
    expect(row).toContain('"62.0%"'); // prob_real ×100
    expect(row).toContain('"18.42%"'); // ev_pct
    expect(row).toContain('"70%"'); // games_over_line_pct ×100
  });

  it("escapes embedded quotes", () => {
    const row = toCsv([makeProp({ player_name: 'A "B" C' })]).split("\n")[1];
    expect(row).toContain('"A ""B"" C"');
  });
});
