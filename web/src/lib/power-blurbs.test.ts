import { describe, expect, it } from "vitest";
import {
  LUCK_THRESHOLD,
  STREAK_FLAME_THRESHOLD,
  luckClause,
  movementKind,
  opener,
  pointsClause,
  powerBlurb,
  streakClause,
  type PowerBlurbInput,
} from "@/lib/power-blurbs";

const input = (overrides: Partial<PowerBlurbInput> = {}): PowerBlurbInput => ({
  rank: 3,
  prevRank: 5,
  points: 110,
  streak: { kind: "W", count: 0 },
  luckScore: null,
  ...overrides,
});

describe("movementKind / opener", () => {
  it("flags a riser when the rank improves", () => {
    expect(movementKind(3, 5)).toBe("riser");
    expect(opener(3, 5)).toBe("Rising from No. 5 to No. 3,");
  });

  it("flags a faller when the rank drops", () => {
    expect(movementKind(7, 4)).toBe("faller");
    expect(opener(7, 4)).toBe("Slipping from No. 4 to No. 7,");
  });

  it("flags a hold when the rank is unchanged", () => {
    expect(movementKind(2, 2)).toBe("hold");
    expect(opener(2, 2)).toBe("Holding steady at No. 2,");
  });

  it("flags the first week when there is no previous rank", () => {
    expect(movementKind(1, null)).toBe("first");
    expect(opener(1, null)).toBe("Opening the board at No. 1,");
  });
});

describe("pointsClause", () => {
  it("calls a huge score a statement", () => {
    expect(pointsClause(145)).toContain("made a statement");
  });

  it("calls a tiny score a bust", () => {
    expect(pointsClause(55)).toContain("scraped together just");
  });

  it("uses neutral wording in between", () => {
    expect(pointsClause(100)).toBe("this team posted 100.0 points");
  });
});

describe("streakClause", () => {
  it("is empty below two games", () => {
    expect(streakClause({ kind: "W", count: 1 })).toBe("");
    expect(streakClause({ kind: "L", count: 0 })).toBe("");
  });

  it("mentions a short win streak without flames", () => {
    const clause = streakClause({ kind: "W", count: 2 });
    expect(clause).toContain("won 2 straight");
    expect(clause).not.toContain("fire");
  });

  it("brings the flames at the threshold", () => {
    const clause = streakClause({ kind: "W", count: STREAK_FLAME_THRESHOLD });
    expect(clause).toContain("catching fire");
    expect(clause).toContain("3-game win streak");
  });

  it("flames a long losing streak too", () => {
    const clause = streakClause({ kind: "L", count: 4 });
    expect(clause).toContain("up in flames");
    expect(clause).toContain("4-game losing streak");
  });
});

describe("luckClause", () => {
  it("is empty when luck is unknown", () => {
    expect(luckClause(null)).toBe("");
  });

  it("is empty for negligible luck", () => {
    expect(luckClause(0.4)).toBe("");
    expect(luckClause(-0.4)).toBe("");
  });

  it("notes over-performance at the threshold", () => {
    expect(luckClause(LUCK_THRESHOLD)).toContain("outperforming their expected wins");
  });

  it("notes under-performance for negative luck", () => {
    expect(luckClause(-2.5)).toContain("underperforming their expected wins by 2.5");
  });
});

describe("powerBlurb", () => {
  it("assembles a full paragraph for a riser on a hot streak", () => {
    const blurb = powerBlurb(
      input({ rank: 2, prevRank: 6, points: 138, streak: { kind: "W", count: 4 }, luckScore: 1.5 })
    );
    expect(blurb).toContain("Rising from No. 6 to No. 2,");
    expect(blurb).toContain("made a statement");
    expect(blurb).toContain("catching fire");
    expect(blurb).toContain("outperforming their expected wins");
    expect(blurb.endsWith(".")).toBe(true);
  });

  it("handles a first-week team with no streak or luck", () => {
    const blurb = powerBlurb(input({ rank: 1, prevRank: null, streak: { kind: "W", count: 0 } }));
    expect(blurb).toBe("Opening the board at No. 1, this team posted 110.0 points.");
  });

  it("is deterministic for identical input", () => {
    const a = powerBlurb(input({ luckScore: -3 }));
    const b = powerBlurb(input({ luckScore: -3 }));
    expect(a).toBe(b);
  });
});
