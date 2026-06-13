import { describe, expect, it } from "vitest";

import { ratingToken } from "./ratingTokens";

describe("ratingToken", () => {
  it("returns the token for a known rating", () => {
    expect(ratingToken("STRONG").dot).toBe("#22c55e");
    expect(ratingToken("VALUE").dot).toBe("#3b82f6");
    expect(ratingToken("AVOID").dot).toBe("#ef4444");
  });
  it("falls back to NEUTRAL for unknown ratings", () => {
    expect(ratingToken("WHATEVER")).toEqual(ratingToken("NEUTRAL"));
  });
});
