import { db } from "../db";
import type { FinalStandingRow, PlayoffStandingRow } from "../types";
import { maskRows, maskedTeamAbbrev, maskedTeamName } from "./shared";

export async function getPlayoffStandings(
  seasonId: number,
  weekNum: number
): Promise<PlayoffStandingRow[]> {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.abbrev, t.color, ps.wins, ps.losses, ps.ties, ps.points_for,
              ps.playoff_seed, ps.playoff_odds,
              o.alias_num AS owner_alias_num
       FROM playoff_snapshots ps JOIN teams t ON t.id = ps.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       WHERE ps.season_id = ? AND ps.week_num = ?
       ORDER BY ps.playoff_seed IS NULL, ps.playoff_seed`
    )
    .all(seasonId, weekNum) as PlayoffStandingRow[];

  return maskRows(rows, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
    abbrev: maskedTeamAbbrev(r.owner_alias_num),
  }));
}

export async function getFinalStandings(seasonId: number): Promise<FinalStandingRow[]> {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.abbrev, t.color, t.final_standing, t.standing,
              ps.wins, ps.losses, ps.ties, ps.points_for,
              o.alias_num AS owner_alias_num
       FROM teams t
       LEFT JOIN owners o ON o.id = t.owner_id
       LEFT JOIN playoff_snapshots ps ON ps.team_id = t.id
         AND ps.week_num = (SELECT MAX(week_num) FROM playoff_snapshots
                            WHERE season_id = t.season_id AND team_id = t.id)
       WHERE t.season_id = ?
       ORDER BY t.final_standing IS NULL, t.final_standing`
    )
    .all(seasonId) as FinalStandingRow[];

  return maskRows(rows, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
    abbrev: maskedTeamAbbrev(r.owner_alias_num),
  }));
}
