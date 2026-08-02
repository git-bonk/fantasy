import { describe, expect, it } from "vitest";
import { matchupKey, winProbability } from "./prediction-math";

describe("matchupKey", () => {
  it("orders the lower team id first", () => {
    expect(matchupKey(1, 2)).toBe("1-2");
    expect(matchupKey(5, 3)).toBe("3-5");
    expect(matchupKey(7, 7)).toBe("7-7");
  });

  it("is symmetric regardless of argument order", () => {
    expect(matchupKey(9, 4)).toBe(matchupKey(4, 9));
  });
});

describe("winProbability", () => {
  it("returns 0.5 for equal ratings", () => {
    expect(winProbability(1500, 1500)).toBeCloseTo(0.5, 10);
  });

  it("favors the higher-rated team", () => {
    expect(winProbability(1600, 1400)).toBeGreaterThan(0.5);
    expect(winProbability(1400, 1600)).toBeLessThan(0.5);
  });

  it("is symmetric (home + away = 1)", () => {
    const home = winProbability(1720, 1430);
    const away = winProbability(1430, 1720);
    expect(home + away).toBeCloseTo(1, 10);
  });

  it("gives ~0.76 for a 200-point gap", () => {
    expect(winProbability(1600, 1400)).toBeCloseTo(0.7597, 3);
  });
});
