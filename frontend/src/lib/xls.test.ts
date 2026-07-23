import { describe, expect, it } from "vitest";

import type { Prop } from "../types/api";
import { toXlsHtml } from "./xls";

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

describe("toXlsHtml", () => {
  it("emits a table with header + one row per prop (colunas de verdade)", () => {
    const html = toXlsHtml([makeProp()]);
    expect(html).toContain("<table>");
    expect((html.match(/<tr>/g) ?? []).length).toBe(2); // header + 1 linha
    expect((html.match(/<th>/g) ?? []).length).toBe(13); // 13 colunas
    expect(html).toContain("<th>Jogador</th>");
    expect(html).toContain("<th>Casa</th>");
  });

  it("formats values", () => {
    const html = toXlsHtml([makeProp()]);
    expect(html).toContain("<td>Nikola Jokic</td>");
    expect(html).toContain("<td>1.90</td>"); // odd
    expect(html).toContain("<td>62.0%</td>"); // prob_real ×100
    expect(html).toContain("<td>18.42%</td>"); // ev_pct
    expect(html).toContain("<td>70%</td>"); // hit%
  });

  it("escapes HTML in values", () => {
    const html = toXlsHtml([makeProp({ player_name: "A <b> & C" })]);
    expect(html).toContain("A &lt;b&gt; &amp; C");
  });
});
