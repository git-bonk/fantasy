import { describe, expect, it } from "vitest";
import {
  careerSpan,
  FRANCHISE_LEGEND_SEASONS,
  headlineStat,
  isFranchiseLegend,
  missedOutSeasons,
  NFL_STAT_KEYS,
  nflStatColumns,
  pointsBySeason,
  summarizeCareer,
  type CompleteNflSeason,
  type PlayerTenureRow,
} from "@/lib/queries/player-career";

const tenure = (over: Partial<PlayerTenureRow> = {}): PlayerTenureRow => ({
  key: "2020-1",
  year: 2020,
  team_id: 1,
  name: "Team 1",
  abbrev: "T1",
  color: "#111111",
  owner_name: "Owner 1",
  owner_alias_num: 1,
  weeks: 12,
  total_points: 100,
  starts: 10,
  benches: 2,
  ...over,
});

describe("isFranchiseLegend", () => {
  it("is false below the threshold", () => {
    expect(isFranchiseLegend(0)).toBe(false);
    expect(isFranchiseLegend(FRANCHISE_LEGEND_SEASONS - 1)).toBe(false);
  });

  it("is true at and above the threshold", () => {
    expect(isFranchiseLegend(FRANCHISE_LEGEND_SEASONS)).toBe(true);
    expect(isFranchiseLegend(FRANCHISE_LEGEND_SEASONS + 2)).toBe(true);
  });
});

describe("summarizeCareer", () => {
  it("sums points and counts distinct seasons", () => {
    const rows = [
      tenure({ year: 2020, total_points: 100 }),
      tenure({ year: 2021, total_points: 50.5 }),
      tenure({ year: 2021, team_id: 2, total_points: 25 }),
    ];
    const summary = summarizeCareer(rows);
    expect(summary.totalPoints).toBeCloseTo(175.5);
    expect(summary.seasonsPlayed).toBe(2);
  });

  it("returns zeros for an empty career", () => {
    expect(summarizeCareer([])).toEqual({
      totalPoints: 0,
      seasonsPlayed: 0,
    });
  });
});

describe("pointsBySeason", () => {
  it("collapses teams within a year and sorts ascending", () => {
    const rows = [
      tenure({ year: 2022, total_points: 30 }),
      tenure({ year: 2020, total_points: 100 }),
      tenure({ year: 2022, team_id: 2, total_points: 12.34 }),
    ];
    expect(pointsBySeason(rows)).toEqual([
      { year: 2020, points: 100 },
      { year: 2022, points: 42.3 },
    ]);
  });

  it("returns an empty array for no tenure", () => {
    expect(pointsBySeason([])).toEqual([]);
  });
});

describe("careerSpan", () => {
  it("returns a dash when both years are missing", () => {
    expect(careerSpan(null, null)).toBe("—");
  });

  it("returns a single year when start equals end", () => {
    expect(careerSpan(2020, 2020)).toBe("2020");
  });

  it("returns an ordered range", () => {
    expect(careerSpan(2018, 2024)).toBe("2018–2024");
    expect(careerSpan(2024, 2018)).toBe("2018–2024");
  });

  it("falls back to the present year when one side is missing", () => {
    expect(careerSpan(null, 2021)).toBe("2021");
    expect(careerSpan(2019, null)).toBe("2019");
  });
});

describe("nflStatColumns", () => {
  it("returns position-appropriate columns", () => {
    expect(nflStatColumns("QB").map((c) => c.key)).toEqual([
      "passingAttempts",
      "passingCompletions",
      "passingYards",
      "passingTouchdowns",
      "passingInterceptions",
    ]);
    expect(nflStatColumns("WR").map((c) => c.key)).toContain("receivingTargets");
    expect(nflStatColumns("TE").map((c) => c.key)).toEqual(
      nflStatColumns("WR").map((c) => c.key)
    );
    expect(nflStatColumns("K").map((c) => c.key)).toContain("madeFieldGoals");
    expect(nflStatColumns("DEF").map((c) => c.key)).toContain("defensiveSacks");
  });

  it("only references stats the query aggregates", () => {
    const keys = new Set<string>(NFL_STAT_KEYS);
    for (const pos of ["QB", "RB", "WR", "TE", "K", "DEF"]) {
      for (const col of nflStatColumns(pos)) {
        expect(keys.has(col.key)).toBe(true);
      }
    }
  });

  it("returns no columns for unknown positions", () => {
    expect(nflStatColumns("")).toEqual([]);
    expect(nflStatColumns("P")).toEqual([]);
  });
});

const nflSeason = (over: Partial<CompleteNflSeason> = {}): CompleteNflSeason => ({
  year: 2025,
  nflTeam: "seattle-seahawks",
  games: 17,
  stats: { receivingYards: 1793 },
  ...over,
});

describe("headlineStat", () => {
  it("formats the position's headline counter with thousands separators", () => {
    expect(headlineStat({ receivingYards: 1793 }, "WR")).toBe("1,793 receiving yards");
    expect(headlineStat({ passingYards: 4201 }, "QB")).toBe("4,201 passing yards");
    expect(headlineStat({ rushingYards: 950 }, "RB")).toBe("950 rushing yards");
    expect(headlineStat({ madeFieldGoals: 36 }, "K")).toBe("36 field goals");
  });

  it("returns null when the counter is missing, zero, or the position is unknown", () => {
    expect(headlineStat({}, "WR")).toBeNull();
    expect(headlineStat({ receivingYards: 0 }, "WR")).toBeNull();
    expect(headlineStat({ defensiveSacks: 12 }, "DEF")).toBeNull();
  });
});

describe("missedOutSeasons", () => {
  it("keeps only seasons with no league roster tenure", () => {
    const seasons = [
      nflSeason({ year: 2023, stats: { receivingYards: 628 } }),
      nflSeason({ year: 2024 }),
      nflSeason({ year: 2025, stats: { receivingYards: 1130 } }),
    ];
    expect(missedOutSeasons(seasons, [2024, 2025], "WR")).toEqual([
      { year: 2023, headline: "628 receiving yards" },
    ]);
  });

  it("returns every season when the player was never rostered", () => {
    const seasons = [nflSeason({ year: 2024 }), nflSeason({ year: 2025 })];
    expect(missedOutSeasons(seasons, [], "WR")).toEqual([
      { year: 2024, headline: "1,793 receiving yards" },
      { year: 2025, headline: "1,793 receiving yards" },
    ]);
  });

  it("returns nothing when every season had league tenure", () => {
    expect(missedOutSeasons([nflSeason({ year: 2025 })], [2025], "WR")).toEqual([]);
  });
});
