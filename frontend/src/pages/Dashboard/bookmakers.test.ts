import { describe, expect, it } from "vitest";

import { bookmakerUrl } from "./bookmakers";

describe("bookmakerUrl", () => {
  it("resolves known bookmakers normalizing case/spaces", () => {
    expect(bookmakerUrl("DraftKings")).toBe("https://sportsbook.draftkings.com");
    expect(bookmakerUrl("draft kings")).toBe("https://sportsbook.draftkings.com");
    expect(bookmakerUrl("PINNACLE")).toBe("https://www.pinnacle.com/sports/basketball");
    expect(bookmakerUrl("bet365")).toBe("https://www.bet365.com");
  });
  it("returns null for unknown / empty input", () => {
    expect(bookmakerUrl("CasaDesconhecida")).toBeNull();
    expect(bookmakerUrl("")).toBeNull();
    expect(bookmakerUrl(null)).toBeNull();
    expect(bookmakerUrl(undefined)).toBeNull();
  });
});
