import { describe, expect, it } from "vitest";

import type { Prop } from "../types/api";
import { applyFilters, applySort, computeMetrics, DEFAULT_FILTERS, gameKey, playerTeam, propKey } from "./props";

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
    prob_real: 0.6,
    ev_pct: 10,
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

describe("gameKey", () => {
  it("builds a sorted canonical game key", () => {
    expect(gameKey(makeProp({ team: "DEN", game: "vs LAL" }))).toBe("DEN vs LAL");
    expect(gameKey(makeProp({ team: "LAL", game: "vs DEN" }))).toBe("DEN vs LAL");
  });
  it("returns empty when incomplete", () => {
    expect(gameKey(makeProp({ team: "", game: "" }))).toBe("");
  });
});

describe("playerTeam", () => {
  it("prefers prop.team", () => {
    expect(playerTeam(makeProp({ team: "DEN" }))).toBe("DEN");
  });
  it("derives from gameKey when team missing", () => {
    expect(playerTeam(makeProp({ team: "", game: "vs LAL" }))).toBe("");
  });
});

describe("applyFilters", () => {
  const props = [
    makeProp({ player_name: "A", market: "PTS", ev_pct: 10, rating: "STRONG" }),
    makeProp({ player_name: "B", market: "REB", ev_pct: 2, rating: "VALUE" }),
    makeProp({ player_name: "C", market: "PTS", ev_pct: -1, rating: "AVOID" }),
  ];
  it("filters by market", () => {
    const r = applyFilters(props, { ...DEFAULT_FILTERS, market: "PTS", minEv: -100 });
    expect(r.map((p) => p.player_name)).toEqual(["A", "C"]);
  });
  it("filters by minEv", () => {
    const r = applyFilters(props, { ...DEFAULT_FILTERS, market: "ALL", minEv: 5 });
    expect(r.map((p) => p.player_name)).toEqual(["A"]);
  });
  it("filters onlyStrong", () => {
    const r = applyFilters(props, { ...DEFAULT_FILTERS, market: "ALL", minEv: -100, onlyStrong: true });
    expect(r.map((p) => p.player_name)).toEqual(["A"]);
  });
  it("filters by search substring (case-insensitive)", () => {
    const r = applyFilters([makeProp({ player_name: "LeBron James" })], { ...DEFAULT_FILTERS, minEv: -100, search: "lebron" });
    expect(r).toHaveLength(1);
  });
});

describe("applySort", () => {
  const props = [makeProp({ ev_pct: 5 }), makeProp({ ev_pct: 12 }), makeProp({ ev_pct: 8 })];
  it("sorts numeric desc", () => {
    expect(applySort(props, { sortBy: "ev_pct", sortDir: "desc" }).map((p) => p.ev_pct)).toEqual([12, 8, 5]);
  });
  it("sorts numeric asc", () => {
    expect(applySort(props, { sortBy: "ev_pct", sortDir: "asc" }).map((p) => p.ev_pct)).toEqual([5, 8, 12]);
  });
  it("sorts strings with localeCompare", () => {
    const byName = applySort([makeProp({ player_name: "B" }), makeProp({ player_name: "A" })], {
      sortBy: "player_name",
      sortDir: "asc",
    });
    expect(byName.map((p) => p.player_name)).toEqual(["A", "B"]);
  });
});

describe("computeMetrics", () => {
  it("aggregates total, EV+, strong, avgEv", () => {
    const m = computeMetrics([
      makeProp({ ev_pct: 10, rating: "STRONG" }),
      makeProp({ ev_pct: -2, rating: "AVOID" }),
      makeProp({ ev_pct: 4, rating: "VALUE" }),
    ]);
    expect(m.total).toBe(3);
    expect(m.evPositiveCount).toBe(2);
    expect(m.strong).toBe(1);
    expect(m.avgEv).toBeCloseTo(7);
  });
});

describe("propKey", () => {
  it("builds the canonical favorite key", () => {
    expect(propKey(makeProp({ player_name: "Jokic", market: "PTS", line: 27.5, direction: "OVER" }))).toBe("Jokic|PTS|27.5|OVER");
  });
});
