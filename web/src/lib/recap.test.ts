import { describe, expect, it } from "vitest";
import { computeTag, type TagContext } from "./recap";
import type { PredictMatchupRow, SeasonMatchupRow } from "./types";

function mk(overrides: Partial<PredictMatchupRow> = {}): PredictMatchupRow {
  return {
    id: 1,
    home_score: 100,
    away_score: 80,
    winner_team_id: 1,
    hid: 1,
    hname: "Home",
    habb: "HOM",
    hcolor: "#111111",
    h_elo: 1500,
    aid: 2,
    aname: "Away",
    aabb: "AWY",
    acolor: "#222222",
    a_elo: 1500,
    ...overrides,
  };
}

function ctx(overrides: Partial<TagContext> = {}): TagContext {
  return {
    weeklyAvg: 90,
    maxCombined: 1000,
    topTeams: new Set<number>(),
    earlier: [],
    ...overrides,
  };
}

function earlier(overrides: Partial<SeasonMatchupRow> = {}): SeasonMatchupRow {
  return {
    week_num: 3,
    home_team_id: 1,
    away_team_id: 2,
    winner_team_id: 2,
    ...overrides,
  };
}

describe("computeTag", () => {
  it("returns null for a tie", () => {
    expect(computeTag(mk({ winner_team_id: null }), ctx())).toBeNull();
  });

  it("tags UPSET when the winner had lower pre-week Elo", () => {
    expect(computeTag(mk({ h_elo: 1400, a_elo: 1600 }), ctx())).toBe("UPSET");
  });

  it("tags UPSET for an away winner with lower Elo", () => {
    expect(
      computeTag(
        mk({ winner_team_id: 2, home_score: 80, away_score: 100, h_elo: 1600, a_elo: 1400 }),
        ctx()
      )
    ).toBe("UPSET");
  });

  it("prefers UPSET over NAIL_BITER on a close upset", () => {
    expect(computeTag(mk({ home_score: 100, away_score: 98, h_elo: 1400, a_elo: 1600 }), ctx())).toBe(
      "UPSET"
    );
  });

  it("falls through to NAIL_BITER when winner Elo is null (week 1)", () => {
    expect(
      computeTag(mk({ home_score: 100, away_score: 97, h_elo: null, a_elo: 1600 }), ctx())
    ).toBe("NAIL_BITER");
  });

  it("tags NAIL_BITER on a margin of exactly 5", () => {
    expect(computeTag(mk({ home_score: 100, away_score: 95 }), ctx())).toBe("NAIL_BITER");
  });

  it("tags BLOWOUT on a margin of exactly 30", () => {
    expect(computeTag(mk({ home_score: 110, away_score: 80 }), ctx())).toBe("BLOWOUT");
  });

  it("tags STATEMENT when both teams are top-N and margin is large", () => {
    expect(computeTag(mk({ home_score: 100, away_score: 80 }), ctx({ topTeams: new Set([1, 2]) }))).toBe(
      "STATEMENT"
    );
  });

  it("does not tag STATEMENT when only one team is top-N", () => {
    expect(computeTag(mk({ home_score: 100, away_score: 80 }), ctx({ topTeams: new Set([1]) }))).toBeNull();
  });

  it("tags REVENGE when the winner lost the earlier meeting", () => {
    expect(computeTag(mk({ home_score: 100, away_score: 90 }), ctx({ earlier: [earlier()] }))).toBe(
      "REVENGE"
    );
  });

  it("does not tag REVENGE when the winner also won the earlier meeting", () => {
    expect(
      computeTag(mk({ home_score: 100, away_score: 90 }), ctx({ earlier: [earlier({ winner_team_id: 1 })] }))
    ).toBeNull();
  });

  it("tags BUST when the winner scored below the weekly-average fraction", () => {
    expect(computeTag(mk({ home_score: 80, away_score: 70 }), ctx({ weeklyAvg: 100 }))).toBe("BUST");
  });

  it("tags SHOOTOUT for the highest combined game of the week", () => {
    expect(computeTag(mk({ home_score: 100, away_score: 80 }), ctx({ maxCombined: 180 }))).toBe(
      "SHOOTOUT"
    );
  });

  it("returns null when no rule matches", () => {
    expect(computeTag(mk({ home_score: 100, away_score: 80 }), ctx())).toBeNull();
  });
});
