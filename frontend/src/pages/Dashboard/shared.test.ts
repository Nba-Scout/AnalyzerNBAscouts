import { describe, expect, it } from "vitest";

import { evColor, hitColor, kellyStake } from "./shared";

describe("evColor", () => {
  it("maps EV% to the 4-tier palette", () => {
    expect(evColor(10)).toBe("#4ade80"); // ≥8 verde forte
    expect(evColor(8)).toBe("#4ade80");
    expect(evColor(3)).toBe("#86efac"); // >0 verde claro
    expect(evColor(0)).toBe("#cbd5e1"); // entre -1 e 0 cinza
    expect(evColor(-0.5)).toBe("#cbd5e1");
    expect(evColor(-2)).toBe("#fca5a5"); // <-1 vermelho
  });
});

describe("hitColor", () => {
  it("maps 0..1 hit rate to traffic-light colors", () => {
    expect(hitColor(0.7)).toBe("#4ade80");
    expect(hitColor(0.6)).toBe("#4ade80");
    expect(hitColor(0.5)).toBe("#fde047");
    expect(hitColor(0.4)).toBe("#fde047");
    expect(hitColor(0.3)).toBe("#fca5a5");
  });
});

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
