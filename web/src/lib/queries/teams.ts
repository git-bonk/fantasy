import { db } from "../db";
import type {
  PositionLeaders,
  SeasonLeaderRow,
  SosRow,
  Team,
  TeamPlayerHistoryRow,
  TeamPointsWeekRow,
  TeamRosterRow,
  TeamStandingRow,
  WeekRosterRow,
} from "../types";
import { maskOne, maskRows, maskedOwnerName, maskedTeamAbbrev, maskedTeamName } from "./shared";

const POSITION_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"];

export async function getTeams(seasonId: number, weekNum?: number): Promise<TeamStandingRow[]> {
  const asOf = weekNum !== undefined ? "AND week_num <= ?" : "";
  const params = weekNum !== undefined ? [weekNum, seasonId] : [seasonId];
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.abbrev, t.owner_name, t.color, t.logo_url,
              ps.wins, ps.losses, ps.points_for, ps.points_against,
              ps.playoff_seed, ps.playoff_odds,
              o.alias_num AS owner_alias_num
       FROM teams t
       LEFT JOIN owners o ON o.id = t.owner_id
       LEFT JOIN playoff_snapshots ps ON ps.team_id = t.id
          AND ps.week_num = (
            SELECT MAX(week_num) FROM playoff_snapshots
            WHERE season_id = t.season_id AND team_id = t.id ${asOf}
          )
       WHERE t.season_id = ?
       ORDER BY ps.playoff_seed IS NULL, ps.playoff_seed, ps.points_for DESC`
    )
    .all(...params) as TeamStandingRow[];

  return maskRows(rows, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
    abbrev: maskedTeamAbbrev(r.owner_alias_num),
    owner_name: maskedOwnerName(r.owner_alias_num),
  }));
}

export async function getTeam(seasonId: number, teamId: number): Promise<Team | undefined> {
  const row = db
    .prepare(
      `SELECT t.*, o.alias_num AS owner_alias_num
       FROM teams t LEFT JOIN owners o ON o.id = t.owner_id
       WHERE t.season_id = ? AND t.id = ?`
    )
    .get(seasonId, teamId) as Team | undefined;
  if (!row) return undefined;

  return maskOne(row, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
    abbrev: maskedTeamAbbrev(r.owner_alias_num),
    owner_name: maskedOwnerName(r.owner_alias_num),
    owner_id: maskedOwnerName(r.owner_alias_num),
  }));
}

export function getTeamSos(seasonId: number, teamId: number): SosRow | undefined {
  return db
    .prepare(
      `SELECT opp_avg_points, sos_rank FROM sos
       WHERE season_id = ? AND team_id = ?
       AND week_num = (SELECT MAX(week_num) FROM sos WHERE season_id = ? AND team_id = ?)`
    )
    .get(seasonId, teamId, seasonId, teamId) as SosRow | undefined;
}

export function getTeamRoster(seasonId: number, teamId: number): TeamRosterRow[] {
  return db
    .prepare(
      `SELECT r.player_name, r.position, r.nfl_team, r.lineup_slot, r.points
       FROM rosters r JOIN weeks w ON w.id = r.week_id
       WHERE w.season_id = ? AND r.team_id = ?
         AND w.week_num = (
           SELECT MAX(week_num) FROM weeks WHERE season_id = ? AND is_playoff = 0
         )
       ORDER BY r.lineup_slot = 'BN', r.points DESC`
    )
    .all(seasonId, teamId, seasonId) as TeamRosterRow[];
}

export function getWeekRosters(seasonId: number, weekNum: number): WeekRosterRow[] {
  return db
    .prepare(
      `SELECT r.team_id, r.player_name, r.position, r.nfl_team, r.lineup_slot, r.points
       FROM rosters r JOIN weeks w ON w.id = r.week_id
       WHERE w.season_id = ? AND w.week_num = ?
       ORDER BY r.team_id, r.lineup_slot = 'BN', r.points DESC`
    )
    .all(seasonId, weekNum) as WeekRosterRow[];
}

export function getTeamPointsByWeek(seasonId: number, teamId: number): TeamPointsWeekRow[] {
  return db
    .prepare(
      `SELECT w.week_num, sub.points FROM (
         SELECT m.week_id, m.home_score points FROM matchups m WHERE m.home_team_id = ?
         UNION ALL
         SELECT m.week_id, m.away_score FROM matchups m WHERE m.away_team_id = ?
       ) sub JOIN weeks w ON w.id = sub.week_id
       WHERE w.season_id = ? ORDER BY w.week_num`
    )
    .all(teamId, teamId, seasonId) as TeamPointsWeekRow[];
}

export function getTeamRecord(seasonId: number, teamId: number) {
  return db
    .prepare(
      `SELECT ps.wins, ps.losses, ps.ties, ps.points_for, ps.points_against,
              ps.playoff_seed, ps.playoff_odds
       FROM playoff_snapshots ps
       WHERE ps.season_id = ? AND ps.team_id = ?
         AND ps.week_num = (
           SELECT MAX(week_num) FROM playoff_snapshots WHERE season_id = ? AND team_id = ?
         )`
    )
    .get(seasonId, teamId, seasonId, teamId) as
    | {
        wins: number;
        losses: number;
        ties: number;
        points_for: number;
        points_against: number;
        playoff_seed: number | null;
        playoff_odds: number | null;
      }
    | undefined;
}

export function getTeamPlayerHistory(seasonId: number, teamId: number): TeamPlayerHistoryRow[] {
  return db
    .prepare(
      `SELECT pp.id AS player_id, r.player_name, r.position, r.nfl_team,
              MIN(w.week_num) AS first_week, MAX(w.week_num) AS last_week,
              COUNT(*) AS weeks_held, SUM(r.points) AS total_points
       FROM rosters r JOIN weeks w ON w.id = r.week_id
       LEFT JOIN players pp ON pp.espn_player_id = r.espn_player_id
       WHERE w.season_id = ? AND r.team_id = ?
       GROUP BY r.espn_player_id, r.player_name, r.position, r.nfl_team
       ORDER BY first_week, total_points DESC`
    )
    .all(seasonId, teamId) as TeamPlayerHistoryRow[];
}

export function getPositionLeaders(seasonId: number, limit = 5): PositionLeaders[] {
  const rows = db
    .prepare(
      `SELECT pp.id AS player_id, r.player_name, r.position,
              SUM(r.points) total_points, COUNT(*) games
       FROM rosters r JOIN weeks w ON w.id = r.week_id
       LEFT JOIN players pp ON pp.espn_player_id = r.espn_player_id
       WHERE w.season_id = ? AND r.lineup_slot != 'BN'
       GROUP BY r.espn_player_id, r.player_name, r.position
       ORDER BY r.position, total_points DESC`
    )
    .all(seasonId) as SeasonLeaderRow[];

  const byPosition = new Map<string, SeasonLeaderRow[]>();
  for (const row of rows) {
    const list = byPosition.get(row.position) ?? [];
    if (list.length < limit) list.push(row);
    byPosition.set(row.position, list);
  }

  return POSITION_ORDER.filter((p) => byPosition.has(p)).map((position) => ({
    position,
    leaders: byPosition.get(position) ?? [],
  }));
}
