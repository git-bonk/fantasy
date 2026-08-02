import { db } from "../db";
import type { PlayerRow } from "../types";
import { maskRows, maskedTeamName } from "./shared";

export interface SeasonPlayerRow {
  espn_player_id: number;
  player_name: string;
  position: string;
  nfl_team: string;
  games: number;
  total_points: number;
  starts: number;
  benches: number;
  team_id: number | null;
  tname: string | null;
  color: string | null;
  owner_alias_num: number | null;
}

export interface SeasonPlayerTableRow extends SeasonPlayerRow {
  ppg: number;
}

/** Points per game; 0 when the player has no recorded games. */
export function ptsPerGame(totalPoints: number, games: number): number {
  if (games <= 0) return 0;
  return totalPoints / games;
}

export async function getTopPerformers(seasonId: number, weekNum: number): Promise<PlayerRow[]> {
  const rows = db
    .prepare(
      `SELECT r.player_name, r.position, r.nfl_team, r.points, t.name tname, t.color,
              o.alias_num AS owner_alias_num
       FROM rosters r JOIN teams t ON t.id = r.team_id JOIN weeks w ON w.id = r.week_id
       LEFT JOIN owners o ON o.id = t.owner_id
       WHERE w.season_id = ? AND w.week_num = ? AND r.lineup_slot != 'BN'
       ORDER BY r.points DESC LIMIT 25`
    )
    .all(seasonId, weekNum) as PlayerRow[];

  return maskRows(rows, (r) => ({
    tname: maskedTeamName(r.owner_alias_num),
  }));
}

/**
 * Every player appearing on any roster during a season, aggregated across weeks:
 * games (distinct weeks), total points, starts (slots ∉ {BN, IR}), benches (BN),
 * and the latest owning team that season (by max week). Team identity is masked
 * like every other query; NFL player names are public.
 */
export async function getSeasonPlayerTable(
  seasonId: number,
  position?: string
): Promise<SeasonPlayerRow[]> {
  const positionFilter = position ? "AND r.position = ?" : "";
  const params = position ? [seasonId, seasonId, position] : [seasonId, seasonId];
  const rows = db
    .prepare(
      `SELECT p.espn_player_id, p.player_name, p.position, p.nfl_team,
              p.games, p.total_points, p.starts, p.benches,
              t.id AS team_id, t.name AS tname, t.color, o.alias_num AS owner_alias_num
       FROM (
         SELECT r.espn_player_id, r.player_name, r.position, r.nfl_team,
                COUNT(DISTINCT w.week_num) AS games,
                SUM(r.points) AS total_points,
                SUM(CASE WHEN r.lineup_slot NOT IN ('BN','IR') THEN 1 ELSE 0 END) AS starts,
                SUM(CASE WHEN r.lineup_slot = 'BN' THEN 1 ELSE 0 END) AS benches,
                (SELECT r2.team_id
                 FROM rosters r2 JOIN weeks w2 ON w2.id = r2.week_id
                 WHERE w2.season_id = ? AND r2.espn_player_id = r.espn_player_id
                 ORDER BY w2.week_num DESC, r2.id DESC LIMIT 1) AS team_id
         FROM rosters r JOIN weeks w ON w.id = r.week_id
         WHERE w.season_id = ? ${positionFilter}
         GROUP BY r.espn_player_id, r.player_name, r.position, r.nfl_team
       ) p
       LEFT JOIN teams t ON t.id = p.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       ORDER BY p.total_points DESC`
    )
    .all(...params) as SeasonPlayerRow[];

  return maskRows(rows, (r) => ({
    tname: r.tname === null ? null : maskedTeamName(r.owner_alias_num),
  }));
}
