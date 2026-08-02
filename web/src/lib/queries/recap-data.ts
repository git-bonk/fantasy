import { db } from "../db";
import type { EloAtWeekRow, LuckRow, RecapAwardRow, SeasonMatchupRow } from "../types";
import { maskRows, maskedTeamName } from "./shared";

export interface RecapAwardFeedRow extends RecapAwardRow {
  team_id: number | null;
}

export async function getRecapAwards(
  seasonId: number,
  weekNum: number
): Promise<RecapAwardFeedRow[]> {
  const rows = db
    .prepare(
      `SELECT a.type, a.value, a.detail, a.player_name, t.id AS team_id, t.name tname, t.color,
              o.alias_num AS owner_alias_num
       FROM awards a JOIN weeks w ON w.id = a.week_id
       LEFT JOIN teams t ON t.id = a.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       WHERE w.season_id = ? AND w.week_num = ?`
    )
    .all(seasonId, weekNum) as RecapAwardFeedRow[];

  return maskRows(rows, (r) => ({
    tname: r.tname === null ? null : maskedTeamName(r.owner_alias_num),
    detail: null,
  }));
}

export async function getRecapLuck(seasonId: number, weekNum: number): Promise<LuckRow[]> {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.color, l.actual_wins, l.expected_wins, l.luck_score,
              o.alias_num AS owner_alias_num
       FROM luck l JOIN teams t ON t.id = l.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       WHERE l.season_id = ? AND l.week_num = ?
       ORDER BY l.luck_score DESC`
    )
    .all(seasonId, weekNum) as LuckRow[];

  return maskRows(rows, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
  }));
}

export function getSeasonMatchups(seasonId: number): SeasonMatchupRow[] {
  return db
    .prepare(
      `SELECT w.week_num, m.home_team_id, m.away_team_id, m.winner_team_id
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       WHERE w.season_id = ? AND w.is_playoff = 0
       ORDER BY w.week_num`
    )
    .all(seasonId) as SeasonMatchupRow[];
}

export function getEloAtWeek(seasonId: number, weekNum: number): EloAtWeekRow[] {
  return db
    .prepare("SELECT team_id, rating FROM elo_ratings WHERE season_id = ? AND week_num = ?")
    .all(seasonId, weekNum) as EloAtWeekRow[];
}
