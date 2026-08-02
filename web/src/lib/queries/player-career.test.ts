import { describe, expect, it } from "vitest";
import {
  careerSpan,
  FRANCHISE_LEGEND_SEASONS,
  isFranchiseLegend,
  pointsBySeason,
  summarizeCareer,
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
