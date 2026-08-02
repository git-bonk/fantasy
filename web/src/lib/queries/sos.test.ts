import { describe, expect, it } from "vitest";
import {
  SOS_FALLBACK_RATING,
  isEvenSos,
  rankRemainingSos,
  sosTier,
  type SosTeamIdentity,
} from "@/lib/queries/sos";

const team = (id: number): SosTeamIdentity => ({
  id,
  name: `Team ${id}`,
  abbrev: `T${id}`,
  color: "#111111",
  owner_alias_num: id,
});

describe("rankRemainingSos", () => {
  it("ranks the hardest remaining schedule first", () => {
    const teams = [team(1), team(2), team(3), team(4)];
    const ratings = new Map([
      [1, 1600],
      [2, 1500],
      [3, 1400],
      [4, 1300],
    ]);
    const matchups = [
      { home_team_id: 4, away_team_id: 1 },
      { home_team_id: 2, away_team_id: 3 },
      { home_team_id: 1, away_team_id: 2 },
    ];

    const rows = rankRemainingSos(teams, matchups, ratings);

    expect(rows.map((r) => r.id)).toEqual([4, 2, 3, 1]);
    expect(rows[0].opp_avg_rating).toBe(1600);
    expect(rows[0].sos_rank).toBe(1);
  });

  it("shares ranks on ties and skips the next rank", () => {
    const teams = [team(1), team(2), team(3), team(4)];
    const ratings = new Map([
      [1, 1600],
      [2, 1500],
      [3, 1400],
      [4, 1300],
    ]);
    const matchups = [
      { home_team_id: 4, away_team_id: 1 },
      { home_team_id: 2, away_team_id: 3 },
      { home_team_id: 1, away_team_id: 2 },
    ];

    const rows = rankRemainingSos(teams, matchups, ratings);
    const byId = new Map(rows.map((r) => [r.id, r]));

    expect(byId.get(2)?.sos_rank).toBe(2);
    expect(byId.get(3)?.sos_rank).toBe(2);
    expect(byId.get(1)?.sos_rank).toBe(4);
  });

  it("counts each matchup once per side, home or away", () => {
    const teams = [team(1), team(2)];
    const matchups = [
      { home_team_id: 1, away_team_id: 2 },
      { home_team_id: 1, away_team_id: 2 },
      { home_team_id: 2, away_team_id: 1 },
    ];

    const rows = rankRemainingSos(teams, matchups, new Map());

    expect(rows.map((r) => r.games_left)).toEqual([3, 3]);
  });

  it("does not double-count a team paired with itself", () => {
    const teams = [team(1), team(2)];
    const matchups = [
      { home_team_id: 1, away_team_id: 2 },
      { home_team_id: 1, away_team_id: 1 },
    ];

    const rows = rankRemainingSos(teams, matchups, new Map());
    const byId = new Map(rows.map((r) => [r.id, r]));

    expect(byId.get(1)?.games_left).toBe(1);
    expect(byId.get(2)?.games_left).toBe(1);
  });

  it("ignores matchups referencing teams outside the season", () => {
    const teams = [team(1)];
    const matchups = [{ home_team_id: 1, away_team_id: 99 }];

    const rows = rankRemainingSos(teams, matchups, new Map());

    expect(rows[0].games_left).toBe(1);
    expect(rows[0].opp_avg_rating).toBe(SOS_FALLBACK_RATING);
  });

  it("falls back to 1500 per opponent when ratings are missing", () => {
    const teams = [team(1), team(2)];
    const matchups = [{ home_team_id: 1, away_team_id: 2 }];

    const rows = rankRemainingSos(teams, matchups, new Map());

    expect(rows.every((r) => r.opp_avg_rating === SOS_FALLBACK_RATING)).toBe(true);
    expect(rows.every((r) => r.sos_rank === 1)).toBe(true);
  });

  it("mixes rated and fallback opponents in the average", () => {
    const teams = [team(1), team(2), team(3)];
    const ratings = new Map([[2, 1600]]);
    const matchups = [
      { home_team_id: 1, away_team_id: 2 },
      { home_team_id: 3, away_team_id: 1 },
    ];

    const rows = rankRemainingSos(teams, matchups, ratings);
    const byId = new Map(rows.map((r) => [r.id, r]));

    expect(byId.get(1)?.opp_avg_rating).toBe((1600 + SOS_FALLBACK_RATING) / 2);
    expect(byId.get(2)?.opp_avg_rating).toBe(SOS_FALLBACK_RATING);
    expect(byId.get(3)?.opp_avg_rating).toBe(SOS_FALLBACK_RATING);
  });

  it("gives idle teams a fallback average and the easiest rank", () => {
    const teams = [team(1), team(2), team(3)];
    const ratings = new Map([
      [1, 1700],
      [2, 1300],
    ]);
    const matchups = [{ home_team_id: 1, away_team_id: 2 }];

    const rows = rankRemainingSos(teams, matchups, ratings);
    const byId = new Map(rows.map((r) => [r.id, r]));

    expect(byId.get(3)?.games_left).toBe(0);
    expect(byId.get(3)?.opp_avg_rating).toBe(SOS_FALLBACK_RATING);
    expect(byId.get(2)?.sos_rank).toBe(1);
    expect(byId.get(3)?.sos_rank).toBe(2);
    expect(byId.get(1)?.sos_rank).toBe(3);
  });
});

describe("isEvenSos", () => {
  it("treats empty and all-equal rows as even", () => {
    expect(isEvenSos([])).toBe(true);
    const rows = rankRemainingSos([team(1), team(2)], [], new Map());
    expect(isEvenSos(rows)).toBe(true);
  });

  it("detects a split schedule", () => {
    const rows = rankRemainingSos(
      [team(1), team(2)],
      [{ home_team_id: 1, away_team_id: 2 }],
      new Map([[1, 1600]])
    );
    expect(isEvenSos(rows)).toBe(false);
  });
});

describe("sosTier", () => {
  const sevenTeamRows = () => {
    const teams = [team(1), team(2), team(3), team(4), team(5), team(6), team(7)];
    const ratings = new Map([
      [1, 1800],
      [2, 1700],
      [3, 1600],
      [4, 1500],
      [5, 1400],
      [6, 1300],
      [7, 1200],
    ]);
    const matchups = [
      { home_team_id: 7, away_team_id: 1 },
      { home_team_id: 6, away_team_id: 2 },
      { home_team_id: 5, away_team_id: 3 },
      { home_team_id: 4, away_team_id: 99 },
    ];
    return rankRemainingSos(teams, matchups, ratings);
  };

  it("tags the top-3 hardest and bottom-3 easiest only", () => {
    const rows = sevenTeamRows();
    const byId = new Map(rows.map((r) => [r.id, r]));

    expect(sosTier(byId.get(7)!, rows)).toBe("hard");
    expect(sosTier(byId.get(4)!, rows)).toBeNull();
    expect(sosTier(byId.get(1)!, rows)).toBe("easy");
  });

  it("returns null for an even schedule", () => {
    const rows = rankRemainingSos(
      [team(1), team(2)],
      [{ home_team_id: 1, away_team_id: 2 }],
      new Map()
    );
    expect(sosTier(rows[0], rows)).toBeNull();
  });
});
