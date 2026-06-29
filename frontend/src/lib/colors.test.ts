import { describe, expect, it } from "vitest";

import { evColor, hitColor } from "./colors";

describe("evColor", () => {
  it("maps EV% to the 4-tier token", () => {
    expect(evColor(10)).toBe("var(--c-ev-strong)");
    expect(evColor(8)).toBe("var(--c-ev-strong)");
    expect(evColor(3)).toBe("var(--c-ev-pos)");
    expect(evColor(0)).toBe("var(--c-ev-neutral)");
    expect(evColor(-0.5)).toBe("var(--c-ev-neutral)");
    expect(evColor(-2)).toBe("var(--c-ev-neg)");
  });
});

describe("hitColor", () => {
  it("maps 0..1 hit rate to traffic-light tokens", () => {
    expect(hitColor(0.7)).toBe("var(--c-hit-hi)");
    expect(hitColor(0.6)).toBe("var(--c-hit-hi)");
    expect(hitColor(0.5)).toBe("var(--c-hit-mid)");
    expect(hitColor(0.4)).toBe("var(--c-hit-mid)");
    expect(hitColor(0.3)).toBe("var(--c-hit-lo)");
  });
});
