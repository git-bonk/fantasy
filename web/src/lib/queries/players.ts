import { db } from "../db";
import type { PlayerRow } from "../types";
import { maskRows, maskedTeamName } from "./shared";

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
