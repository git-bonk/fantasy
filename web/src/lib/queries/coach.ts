import { db } from "../db";
import { maskRows, maskedTeamAbbrev, maskedTeamName } from "./shared";

export interface CoachLeaderboardRow {
  id: number;
  name: string;
  abbrev: string;
  color: string;
  avg_efficiency: number;
  bench_points: number;
  weeks: number;
  owner_alias_num?: number | null;
}

export interface CoachWeekRow {
  id: number;
  name: string;
  abbrev: string;
  color: string;
  actual_points: number;
  optimal_points: number;
  bench_points: number;
  efficiency: number;
  owner_alias_num?: number | null;
}

export async function getCoachLeaderboard(seasonId: number): Promise<CoachLeaderboardRow[]> {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.abbrev, t.color,
              AVG(cr.efficiency) AS avg_efficiency,
              SUM(cr.bench_points) AS bench_points,
              COUNT(*) AS weeks,
              o.alias_num AS owner_alias_num
       FROM coach_ratings cr
       JOIN teams t ON t.id = cr.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       WHERE cr.season_id = @seasonId
       GROUP BY t.id
       ORDER BY avg_efficiency DESC`
    )
    .all({ seasonId }) as CoachLeaderboardRow[];

  return maskRows(rows, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
    abbrev: maskedTeamAbbrev(r.owner_alias_num),
  }));
}

export async function getCoachWeek(seasonId: number, weekNum: number): Promise<CoachWeekRow[]> {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.abbrev, t.color,
              cr.actual_points, cr.optimal_points, cr.bench_points, cr.efficiency,
              o.alias_num AS owner_alias_num
       FROM coach_ratings cr
       JOIN teams t ON t.id = cr.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       WHERE cr.season_id = @seasonId AND cr.week_num = @weekNum
       ORDER BY cr.efficiency DESC`
    )
    .all({ seasonId, weekNum }) as CoachWeekRow[];

  return maskRows(rows, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
    abbrev: maskedTeamAbbrev(r.owner_alias_num),
  }));
}
