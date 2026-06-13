import { describe, expect, it } from "vitest";

import { fmtKelly, fmtOdd, fmtPct, fmtProb, normEv, normKelly } from "./format";

describe("fmtOdd", () => {
  it("formats decimal odds with 2 casas", () => {
    expect(fmtOdd(1.9)).toBe("1.90");
    expect(fmtOdd(1.95)).toBe("1.95");
    expect(fmtOdd(2.5)).toBe("2.50");
  });
  it("formats implied probability", () => {
    expect(fmtOdd(2, "implied")).toBe("50.0%");
    expect(fmtOdd(4, "implied")).toBe("25.0%");
  });
});

describe("fmtPct", () => {
  it("adds + sign for positives", () => {
    expect(fmtPct(5.2)).toBe("+5.2%");
    expect(fmtPct(-3)).toBe("-3.0%");
    expect(fmtPct(0)).toBe("0.0%");
  });
});

describe("fmtProb", () => {
  it("converts 0..1 to percent", () => {
    expect(fmtProb(0.62)).toBe("62.0%");
  });
});

describe("fmtKelly", () => {
  it("divides full kelly by the mode divisor", () => {
    expect(fmtKelly(20, "quarter")).toBe("5.0%");
    expect(fmtKelly(20, "half")).toBe("10.0%");
    expect(fmtKelly(20, "full")).toBe("20.0%");
    expect(fmtKelly(20, "eighth")).toBe("2.5%");
  });
});

describe("normEv / normKelly", () => {
  it("normalizes and clamps to 0..1", () => {
    expect(normEv(-5)).toBe(0);
    expect(normEv(15)).toBe(1);
    expect(normEv(5)).toBeCloseTo(0.5);
    expect(normEv(-100)).toBe(0);
    expect(normKelly(0)).toBe(0);
    expect(normKelly(5)).toBe(1);
    expect(normKelly(10)).toBe(1);
  });
});
