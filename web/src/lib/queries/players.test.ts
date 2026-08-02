import { describe, expect, it } from "vitest";
import { ptsPerGame } from "@/lib/queries/players";

describe("ptsPerGame", () => {
  it("divides total points by games played", () => {
    expect(ptsPerGame(120, 6)).toBe(20);
  });

  it("returns 0 when no games are played", () => {
    expect(ptsPerGame(45, 0)).toBe(0);
  });

  it("guards against negative games", () => {
    expect(ptsPerGame(45, -1)).toBe(0);
  });

  it("computes fractional averages", () => {
    expect(ptsPerGame(100, 3)).toBeCloseTo(33.3333, 3);
  });

  it("returns 0 for a scoreless player who played", () => {
    expect(ptsPerGame(0, 5)).toBe(0);
  });
});
