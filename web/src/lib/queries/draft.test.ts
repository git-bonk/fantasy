import { describe, expect, it } from "vitest";
import {
  roundValues,
  teamBestWorst,
  valueOverRound,
  type DraftValuePick,
} from "@/lib/queries/draft";

function pick(over: Partial<DraftValuePick> & { round_num: number; produced: number }): DraftValuePick {
  return {
    team_id: 1,
    espn_team_id: 1,
    tname: "Team",
    color: "#fff",
    owner_alias_num: 1,
    player_name: "Player",
    position: "RB",
    round_pick: 1,
    ...over,
  };
}

describe("roundValues", () => {
  it("averages produced points per round in ascending order", () => {
    const picks = [
      pick({ round_num: 2, produced: 30 }),
      pick({ round_num: 1, produced: 100 }),
      pick({ round_num: 1, produced: 50 }),
      pick({ round_num: 2, produced: 10 }),
    ];
    expect(roundValues(picks)).toEqual([
      { round_num: 1, avg_produced: 75, picks: 2 },
      { round_num: 2, avg_produced: 20, picks: 2 },
    ]);
  });

  it("returns an empty curve for no picks", () => {
    expect(roundValues([])).toEqual([]);
  });
});

describe("valueOverRound", () => {
  it("subtracts the round average from produced points", () => {
    expect(valueOverRound(120, 80)).toBe(40);
    expect(valueOverRound(30, 80)).toBe(-50);
  });
});

describe("teamBestWorst", () => {
  it("selects each team's best and worst pick by value over round", () => {
    const picks = [
      // Round 1 averages (0 + 100) / 2 = 50; round 5 averages (80 + 20) / 2 = 50.
      pick({ team_id: 1, player_name: "Early Bust", round_num: 1, produced: 0 }),
      pick({ team_id: 2, player_name: "Early Star", round_num: 1, produced: 100 }),
      pick({ team_id: 1, player_name: "Late Steal", round_num: 5, produced: 80 }),
      pick({ team_id: 2, player_name: "Late Meh", round_num: 5, produced: 20 }),
    ];
    const result = teamBestWorst(picks);
    const team1 = result.find((r) => r.team_id === 1);
    expect(team1?.best.player_name).toBe("Late Steal");
    expect(team1?.best.value_over_round).toBe(30);
    expect(team1?.worst.player_name).toBe("Early Bust");
    expect(team1?.worst.value_over_round).toBe(-50);
  });

  it("orders teams by best-pick value descending", () => {
    const picks = [
      pick({ team_id: 1, player_name: "A", round_num: 1, produced: 10 }),
      pick({ team_id: 2, player_name: "B", round_num: 1, produced: 200 }),
    ];
    const result = teamBestWorst(picks);
    expect(result.map((r) => r.team_id)).toEqual([2, 1]);
  });

  it("handles a team with a single pick (best === worst)", () => {
    const picks = [pick({ team_id: 3, player_name: "Solo", round_num: 1, produced: 42 })];
    const result = teamBestWorst(picks);
    expect(result).toHaveLength(1);
    expect(result[0].best.player_name).toBe("Solo");
    expect(result[0].worst.player_name).toBe("Solo");
  });
});
