import { describe, expect, it } from "vitest";
import { isIdle } from "./idle";

describe("isIdle", () => {
  it("coupe au-delà de 30 min, pas avant (veille comprise)", () => {
    expect(isIdle(0, 30 * 60_000)).toBe(false);
    expect(isIdle(0, 30 * 60_000 + 1)).toBe(true);
    expect(isIdle(1_000, 3 * 3_600_000)).toBe(true);
  });
});
