import { db } from "../db";
import type { FinalStandingRow, PlayoffStandingRow } from "../types";
import { maskRows, maskedTeamAbbrev, maskedTeamName } from "./shared";
import {
  rankRemainingSos,
  type RemainingSosRow,
  type SosMatchupPair,
  type SosTeamIdentity,
} from "./sos";

interface SosRatingRow {
  team_id: number;
  rating: number;
}

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

export function getLatestRatedWeek(seasonId: number): number {
  const row = db
    .prepare("SELECT MAX(week_num) AS max_week FROM elo_ratings WHERE season_id = ?")
    .get(seasonId) as { max_week: number | null };
  return row.max_week ?? 0;
}

export async function getRemainingSos(
  seasonId: number,
  throughWeek: number
): Promise<RemainingSosRow[]> {
  const teams = db
    .prepare(
      `SELECT t.id, t.name, t.abbrev, t.color,
              o.alias_num AS owner_alias_num
       FROM teams t
       LEFT JOIN owners o ON o.id = t.owner_id
       WHERE t.season_id = @seasonId
       ORDER BY t.id`
    )
    .all({ seasonId }) as SosTeamIdentity[];

  const matchups = db
    .prepare(
      `SELECT home_team_id, away_team_id
       FROM scheduled_matchups
       WHERE season_id = @seasonId AND week_num > @throughWeek`
    )
    .all({ seasonId, throughWeek }) as SosMatchupPair[];
  if (matchups.length === 0) return [];

  const ratings = db
    .prepare(
      `SELECT e.team_id, e.rating
       FROM elo_ratings e
       WHERE e.season_id = @seasonId
         AND e.week_num = (SELECT MAX(e2.week_num) FROM elo_ratings e2
                           WHERE e2.season_id = @seasonId AND e2.team_id = e.team_id)`
    )
    .all({ seasonId }) as SosRatingRow[];

  const rows = rankRemainingSos(
    teams,
    matchups,
    new Map(ratings.map((r) => [r.team_id, r.rating]))
  );

  return maskRows(rows, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
    abbrev: maskedTeamAbbrev(r.owner_alias_num),
  }));
}
