import { describe, expect, it } from "vitest";

import type { RecentGame } from "../types/api";
import { getStatValue } from "./playerStats";

function makeGame(over: Partial<RecentGame> = {}): RecentGame {
  return {
    date: "2026-03-01",
    opp: "LAL",
    home_away: "home",
    min: 34,
    pts: 30,
    reb: 12,
    ast: 8,
    fg3m: 2,
    blk: 1,
    stl: 1,
    is_playoff: false,
    margin: 5,
    team_score: 110,
    opp_score: 105,
    ...over,
  };
}

describe("getStatValue", () => {
  const g = makeGame();
  it("returns base stats", () => {
    expect(getStatValue(g, "PTS")).toBe(30);
    expect(getStatValue(g, "REB")).toBe(12);
    expect(getStatValue(g, "AST")).toBe(8);
    expect(getStatValue(g, "FG3M")).toBe(2);
    expect(getStatValue(g, "BLK")).toBe(1);
    expect(getStatValue(g, "STL")).toBe(1);
  });
  it("computes combos", () => {
    expect(getStatValue(g, "PRA")).toBe(50);
    expect(getStatValue(g, "PR")).toBe(42);
    expect(getStatValue(g, "PA")).toBe(38);
    expect(getStatValue(g, "RA")).toBe(20);
    expect(getStatValue(g, "STOCKS")).toBe(2);
  });
  it("returns null for unknown market", () => {
    expect(getStatValue(g, "ALL")).toBeNull();
  });
});
