import { describe, expect, it } from "vitest";

import { kellyStake } from "./shared";

describe("kellyStake", () => {
  it("divides the full kelly by the mode divisor and rounds R$", () => {
    // bankroll 1000, kelly cheio 20% → quarter = 5% → R$50
    expect(kellyStake(1000, 20, "quarter")).toBe(50);
    expect(kellyStake(1000, 20, "half")).toBe(100);
    expect(kellyStake(1000, 20, "full")).toBe(200);
    expect(kellyStake(1000, 20, "eighth")).toBe(25);
  });
  it("rounds to the nearest real", () => {
    // 1500 * 7 / 4 / 100 = 26.25 → 26
    expect(kellyStake(1500, 7, "quarter")).toBe(26);
  });
});
