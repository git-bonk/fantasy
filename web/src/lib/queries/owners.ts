import { db } from "../db";
import type {
  LeagueHistoryRow,
  OwnerEloHistoryRow,
  OwnerStandingRow,
  SeasonSettings,
} from "../types";
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

export interface OwnerCareerTeamRow {
  team_id: number;
  year: number;
  name: string;
  abbrev: string;
  color: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number | null;
  points_against: number | null;
  final_standing: number | null;
  playoff_cutoff: number | null;
  owner_alias_num?: number | null;
}

export interface OwnerCareerSummary {
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number | null;
  points_against: number | null;
  titles: number;
  runner_ups: number;
  appearances: number;
}

export interface OwnerCareer {
  teams: OwnerCareerTeamRow[];
  summary: OwnerCareerSummary;
}

export interface CareerTeamRecord {
  wins: number;
  losses: number;
  ties: number;
  points_for: number | null;
  points_against: number | null;
  final_standing: number | null;
  playoff_cutoff?: number | null;
}

interface RawCareerTeamRow {
  team_id: number;
  year: number;
  name: string;
  abbrev: string;
  color: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number | null;
  points_against: number | null;
  final_standing: number | null;
  settings_json: string;
  owner_alias_num: number | null;
}

function playoffCutoffFromSettings(settingsJson: string): number | null {
  try {
    const settings = JSON.parse(settingsJson) as SeasonSettings;
    return settings.playoff?.team_count ?? settings.playoff_teams ?? null;
  } catch {
    return null;
  }
}

// Per team-season, the record prefers the team's latest playoff_snapshots row:
// ESPN's official regular-season W/L/T and PF/PA, the same source getTeams and
// getFinalStandings render, so hub numbers match every standings page. Deriving
// from matchups.winner_team_id (the getOwnerStandings approach) folds playoff
// and consolation games into the record, so it is only a fallback for
// team-seasons that have no snapshot rows.
export async function getOwnerCareerByAlias(aliasNum: number): Promise<OwnerCareer> {
  const raw = db
    .prepare(
      `SELECT t.id AS team_id, s.year, t.name, t.abbrev, t.color, t.final_standing,
              s.settings_json,
              o.alias_num AS owner_alias_num,
              COALESCE(ps.wins, rec.wins, 0) AS wins,
              COALESCE(ps.losses, rec.losses, 0) AS losses,
              COALESCE(ps.ties, rec.ties, 0) AS ties,
              COALESCE(ps.points_for, rec.points_for) AS points_for,
              COALESCE(ps.points_against, rec.points_against) AS points_against
       FROM teams t
       JOIN seasons s ON s.id = t.season_id
       JOIN owners o ON o.id = t.owner_id
       LEFT JOIN playoff_snapshots ps ON ps.team_id = t.id
         AND ps.week_num = (
           SELECT MAX(ps2.week_num) FROM playoff_snapshots ps2
           WHERE ps2.season_id = t.season_id AND ps2.team_id = t.id
         )
       LEFT JOIN (
         SELECT sub.team_id,
                SUM(CASE WHEN sub.outcome = 'W' THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN sub.outcome = 'L' THEN 1 ELSE 0 END) AS losses,
                SUM(CASE WHEN sub.outcome = 'T' THEN 1 ELSE 0 END) AS ties,
                SUM(sub.score) AS points_for,
                SUM(sub.opp_score) AS points_against
         FROM (
           SELECT m.home_team_id AS team_id,
                  CASE WHEN m.winner_team_id = m.home_team_id THEN 'W'
                       WHEN m.winner_team_id IS NULL THEN 'T' ELSE 'L' END AS outcome,
                  m.home_score AS score, m.away_score AS opp_score
           FROM matchups m
           UNION ALL
           SELECT m.away_team_id AS team_id,
                  CASE WHEN m.winner_team_id = m.away_team_id THEN 'W'
                       WHEN m.winner_team_id IS NULL THEN 'T' ELSE 'L' END AS outcome,
                  m.away_score AS score, m.home_score AS opp_score
           FROM matchups m
         ) sub
         GROUP BY sub.team_id
       ) rec ON rec.team_id = t.id
       WHERE o.alias_num = ?
       ORDER BY s.year, t.id`
    )
    .all(aliasNum) as RawCareerTeamRow[];

  const mapped: OwnerCareerTeamRow[] = raw.map((r) => ({
    team_id: r.team_id,
    year: r.year,
    name: r.name,
    abbrev: r.abbrev,
    color: r.color,
    wins: r.wins,
    losses: r.losses,
    ties: r.ties,
    points_for: r.points_for,
    points_against: r.points_against,
    final_standing: r.final_standing,
    playoff_cutoff: playoffCutoffFromSettings(r.settings_json),
    owner_alias_num: r.owner_alias_num,
  }));

  const teams = await maskRows(mapped, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
    abbrev: maskedTeamAbbrev(r.owner_alias_num),
  }));

  return { teams, summary: summarizeOwnerCareer(teams) };
}

// Aggregates a career from per-season rows. A "playoff appearance" is a
// completed season (final_standing IS NOT NULL AND > 0) whose finish is within
// the season's playoff cutoff; when the cutoff is unknown the completed-season
// signal alone counts.
export function summarizeOwnerCareer(teams: CareerTeamRecord[]): OwnerCareerSummary {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  let pfSeasons = 0;
  let paSeasons = 0;
  let titles = 0;
  let runnerUps = 0;
  let appearances = 0;

  for (const team of teams) {
    wins += team.wins;
    losses += team.losses;
    ties += team.ties;
    if (team.points_for != null) {
      pointsFor += team.points_for;
      pfSeasons += 1;
    }
    if (team.points_against != null) {
      pointsAgainst += team.points_against;
      paSeasons += 1;
    }
    if (team.final_standing != null && team.final_standing > 0) {
      if (team.final_standing === 1) titles += 1;
      if (team.final_standing === 2) runnerUps += 1;
      const cutoff = team.playoff_cutoff ?? null;
      if (cutoff == null || team.final_standing <= cutoff) appearances += 1;
    }
  }

  return {
    seasons: teams.length,
    wins,
    losses,
    ties,
    points_for: pfSeasons > 0 ? pointsFor : null,
    points_against: paSeasons > 0 ? pointsAgainst : null,
    titles,
    runner_ups: runnerUps,
    appearances,
  };
}

export function seasonWinPct(team: CareerTeamRecord): number | null {
  const games = team.wins + team.losses + team.ties;
  return games > 0 ? team.wins / games : null;
}

export function pickSeasonExtremes<T extends CareerTeamRecord>(teams: T[]): {
  best: T | null;
  worst: T | null;
} {
  let best: T | null = null;
  let worst: T | null = null;
  for (const team of teams) {
    const pct = seasonWinPct(team);
    if (pct == null) continue;
    if (best == null || pct > (seasonWinPct(best) ?? 0)) best = team;
    if (worst == null || pct < (seasonWinPct(worst) ?? 0)) worst = team;
  }
  return { best, worst };
}

export interface TrophySeasonRow {
  year: number;
  team_id: number;
  name: string;
  abbrev: string;
  color: string;
  final_standing: number;
  owner_alias_num?: number | null;
}

export interface OwnerAwardCountRow {
  type: string;
  count: number;
}

export interface OwnerTrophies {
  championships: TrophySeasonRow[];
  runnerUps: TrophySeasonRow[];
  awards: OwnerAwardCountRow[];
}

export async function getOwnerTrophiesByAlias(aliasNum: number): Promise<OwnerTrophies> {
  const seasonRows = db
    .prepare(
      `SELECT s.year, t.id AS team_id, t.name, t.abbrev, t.color, t.final_standing,
              o.alias_num AS owner_alias_num
       FROM teams t
       JOIN seasons s ON s.id = t.season_id
       JOIN owners o ON o.id = t.owner_id
       WHERE o.alias_num = ? AND t.final_standing IN (1, 2)
       ORDER BY s.year`
    )
    .all(aliasNum) as TrophySeasonRow[];

  const masked = await maskRows(seasonRows, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
    abbrev: maskedTeamAbbrev(r.owner_alias_num),
  }));

  const awards = db
    .prepare(
      `SELECT a.type, COUNT(*) AS count
       FROM awards a
       JOIN teams t ON t.id = a.team_id
       JOIN owners o ON o.id = t.owner_id
       WHERE o.alias_num = ?
       GROUP BY a.type
       ORDER BY COUNT(*) DESC, a.type`
    )
    .all(aliasNum) as OwnerAwardCountRow[];

  return {
    championships: masked.filter((r) => r.final_standing === 1),
    runnerUps: masked.filter((r) => r.final_standing === 2),
    awards,
  };
}
