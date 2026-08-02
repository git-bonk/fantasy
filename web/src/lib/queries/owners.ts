import { db } from "../db";
import type { LeagueHistoryRow, OwnerEloHistoryRow, OwnerStandingRow } from "../types";
import { maskRows, maskedOwnerName, maskedTeamAbbrev, maskedTeamName } from "./shared";

export async function getLeagueHistory(): Promise<LeagueHistoryRow[]> {
  const rows = db
    .prepare(
      `SELECT t.owner_name, t.owner_id, t.name AS team_name, t.abbrev, t.color, s.year,
              o.alias_num AS owner_alias_num
       FROM teams t JOIN seasons s ON s.id = t.season_id
       LEFT JOIN owners o ON o.id = t.owner_id
       ORDER BY s.year DESC, t.id`
    )
    .all() as LeagueHistoryRow[];

  return maskRows(rows, (r) => ({
    owner_name: maskedOwnerName(r.owner_alias_num),
    owner_id: maskedOwnerName(r.owner_alias_num),
    team_name: maskedTeamName(r.owner_alias_num),
    abbrev: maskedTeamAbbrev(r.owner_alias_num),
  }));
}

export async function getOwnerStandings(): Promise<OwnerStandingRow[]> {
  const rows = db
    .prepare(
      `SELECT o.id AS owner_id, o.display_name, o.first_name, o.last_name,
              o.alias_num AS owner_alias_num,
              latest.rating AS rating,
              COALESCE(rec.wins, 0) AS wins,
              COALESCE(rec.losses, 0) AS losses,
              COALESCE(rec.ties, 0) AS ties
       FROM owners o
       JOIN (
         SELECT oe.owner_id, oe.rating
         FROM owner_elo oe
         JOIN seasons s ON s.id = oe.season_id
         WHERE oe.id = (
           SELECT oe2.id FROM owner_elo oe2
           JOIN seasons s2 ON s2.id = oe2.season_id
           WHERE oe2.owner_id = oe.owner_id
           ORDER BY s2.year DESC, oe2.week_num DESC
           LIMIT 1
         )
       ) latest ON latest.owner_id = o.id
       LEFT JOIN (
         SELECT owner_id,
                SUM(CASE WHEN outcome = 'W' THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN outcome = 'L' THEN 1 ELSE 0 END) AS losses,
                SUM(CASE WHEN outcome = 'T' THEN 1 ELSE 0 END) AS ties
         FROM (
           SELECT th.owner_id AS owner_id,
                  CASE WHEN m.winner_team_id = m.home_team_id THEN 'W'
                       WHEN m.winner_team_id IS NULL THEN 'T' ELSE 'L' END AS outcome
           FROM matchups m JOIN teams th ON th.id = m.home_team_id
           WHERE th.owner_id IS NOT NULL
           UNION ALL
           SELECT ta.owner_id AS owner_id,
                  CASE WHEN m.winner_team_id = m.away_team_id THEN 'W'
                       WHEN m.winner_team_id IS NULL THEN 'T' ELSE 'L' END AS outcome
           FROM matchups m JOIN teams ta ON ta.id = m.away_team_id
           WHERE ta.owner_id IS NOT NULL
         ) sub
         GROUP BY owner_id
       ) rec ON rec.owner_id = o.id
        ORDER BY latest.rating DESC`
    )
    .all() as OwnerStandingRow[];

  return maskRows(rows, (r) => ({
    owner_id: maskedOwnerName(r.owner_alias_num),
    display_name: maskedOwnerName(r.owner_alias_num),
    first_name: null,
    last_name: null,
  }));
}

export function getOwnerEloHistoryByAlias(aliasNum: number): OwnerEloHistoryRow[] {
  return db
    .prepare(
      `SELECT s.year, oe.season_id, oe.week_num, oe.rating
       FROM owner_elo oe
       JOIN owners o ON o.id = oe.owner_id
       JOIN seasons s ON s.id = oe.season_id
       WHERE o.alias_num = ?
       ORDER BY s.year, oe.week_num`
    )
    .all(aliasNum) as OwnerEloHistoryRow[];
}
