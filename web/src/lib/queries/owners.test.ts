import { describe, expect, it } from "vitest";
import {
  pickSeasonExtremes,
  seasonWinPct,
  summarizeOwnerCareer,
  type CareerTeamRecord,
} from "@/lib/queries/owners";

const season = (overrides: Partial<CareerTeamRecord> = {}): CareerTeamRecord => ({
  wins: 0,
  losses: 0,
  ties: 0,
  points_for: null,
  points_against: null,
  final_standing: null,
  playoff_cutoff: 6,
  ...overrides,
});

describe("summarizeOwnerCareer", () => {
  it("returns all-zero aggregates and null points for empty input", () => {
    expect(summarizeOwnerCareer([])).toEqual({
      seasons: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      points_for: null,
      points_against: null,
      titles: 0,
      runner_ups: 0,
      appearances: 0,
    });
  });

  it("summarizes a single-season owner", () => {
    const summary = summarizeOwnerCareer([
      season({
        wins: 8,
        losses: 5,
        ties: 1,
        points_for: 1512.5,
        points_against: 1401,
        final_standing: 1,
      }),
    ]);

    expect(summary.seasons).toBe(1);
    expect(summary.wins).toBe(8);
    expect(summary.losses).toBe(5);
    expect(summary.ties).toBe(1);
    expect(summary.points_for).toBe(1512.5);
    expect(summary.points_against).toBe(1401);
    expect(summary.titles).toBe(1);
    expect(summary.runner_ups).toBe(0);
    expect(summary.appearances).toBe(1);
  });

  it("counts titles, runner-ups, and appearances across seasons", () => {
    const summary = summarizeOwnerCareer([
      season({ wins: 9, losses: 4, final_standing: 1 }),
      season({ wins: 7, losses: 6, final_standing: 2 }),
      season({ wins: 5, losses: 8, final_standing: 7 }),
      season({ wins: 6, losses: 7, final_standing: null }),
    ]);

    expect(summary.seasons).toBe(4);
    expect(summary.titles).toBe(1);
    expect(summary.runner_ups).toBe(1);
    // 7th of 12 with a 6-team cutoff is not a playoff appearance; the
    // in-progress season (no final_standing) is not one either.
    expect(summary.appearances).toBe(2);
  });

  it("counts any completed season as an appearance when the cutoff is unknown", () => {
    const summary = summarizeOwnerCareer([
      season({ wins: 5, losses: 8, final_standing: 7, playoff_cutoff: null }),
      season({ wins: 4, losses: 9, final_standing: 11, playoff_cutoff: undefined }),
    ]);

    expect(summary.appearances).toBe(2);
    expect(summary.titles).toBe(0);
    expect(summary.runner_ups).toBe(0);
  });

  it("sums points only across seasons that recorded them", () => {
    const summary = summarizeOwnerCareer([
      season({ wins: 8, losses: 5, points_for: 1500, points_against: 1300 }),
      season({ wins: 6, losses: 7 }),
      season({ wins: 7, losses: 6, points_for: 1400.25, points_against: 1350.75 }),
    ]);

    expect(summary.points_for).toBe(2900.25);
    expect(summary.points_against).toBe(2650.75);
  });
});

describe("seasonWinPct", () => {
  it("returns null when no games were played", () => {
    expect(seasonWinPct(season())).toBeNull();
  });

  it("counts ties as played games", () => {
    expect(seasonWinPct(season({ wins: 6, losses: 6, ties: 2 }))).toBeCloseTo(6 / 14);
  });
});

describe("pickSeasonExtremes", () => {
  it("returns nulls when no season has games", () => {
    expect(pickSeasonExtremes([season(), season()])).toEqual({ best: null, worst: null });
    expect(pickSeasonExtremes([])).toEqual({ best: null, worst: null });
  });

  it("picks the best and worst seasons by win percentage", () => {
    const peak = season({ wins: 11, losses: 2 });
    const mid = season({ wins: 7, losses: 6 });
    const slump = season({ wins: 3, losses: 10 });

    const { best, worst } = pickSeasonExtremes([mid, slump, peak, season()]);

    expect(best).toBe(peak);
    expect(worst).toBe(slump);
  });

  it("returns the same season for both extremes with a single played season", () => {
    const only = season({ wins: 8, losses: 5 });
    expect(pickSeasonExtremes([only])).toEqual({ best: only, worst: only });
  });

  it("keeps the earlier season on ties", () => {
    const first = season({ wins: 7, losses: 6 });
    const second = season({ wins: 7, losses: 6 });

    const { best, worst } = pickSeasonExtremes([first, second]);

    expect(best).toBe(first);
    expect(worst).toBe(first);
  });
});
