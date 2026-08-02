import { db } from "../db";
import type { EloHistoryRow, RankingRow } from "../types";
import { maskRows, maskedTeamAbbrev, maskedTeamName } from "./shared";

export async function getRankings(seasonId: number): Promise<RankingRow[]> {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.abbrev, t.color, e.rating,
              COALESCE(ps.wins, 0) AS wins,
              COALESCE(ps.losses, 0) AS losses,
              COALESCE(ps.ties, 0) AS ties,
              COALESCE(ps.points_for, 0) AS points_for,
              o.alias_num AS owner_alias_num
       FROM elo_ratings e JOIN teams t ON t.id = e.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       LEFT JOIN playoff_snapshots ps ON ps.team_id = t.id
          AND ps.season_id = e.season_id AND ps.week_num = e.week_num
       WHERE e.season_id = ? AND e.week_num = (
          SELECT MAX(week_num) FROM weeks WHERE season_id = ? AND is_playoff = 0
        )
         ORDER BY e.rating DESC`
    )
    .all(seasonId, seasonId) as RankingRow[];

  return maskRows(rows, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
    abbrev: maskedTeamAbbrev(r.owner_alias_num),
  }));
}

export async function getSeasonPowerRankings(seasonId: number): Promise<RankingRow[]> {
  return getRankings(seasonId);
}

export async function getEloHistory(seasonId: number): Promise<EloHistoryRow[]> {
  const rows = db
    .prepare(
      `SELECT e.week_num, t.id, t.name, t.color, e.rating,
              o.alias_num AS owner_alias_num
       FROM elo_ratings e JOIN teams t ON t.id = e.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       WHERE e.season_id = ? ORDER BY e.week_num`
    )
    .all(seasonId) as EloHistoryRow[];

  return maskRows(rows, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
  }));
}
