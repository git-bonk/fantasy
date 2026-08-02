import { db } from "../db";
import { maskRows, maskedOwnerName, maskedTeamAbbrev, maskedTeamName } from "./shared";

/** Seasons a player must spend under one owner to be a "franchise legend". */
export const FRANCHISE_LEGEND_SEASONS = 3;

export interface PlayerCareer {
  fullName: string;
  position: string;
  nflTeam: string;
  firstYear: number | null;
  lastYear: number | null;
}

export interface PlayerTenureRow {
  key: string;
  year: number;
  team_id: number;
  name: string;
  abbrev: string;
  color: string;
  owner_name: string;
  owner_id: string | null;
  owner_alias_num: number | null;
  weeks: number;
  total_points: number;
  starts: number;
  benches: number;
}

export interface CareerSummary {
  totalPoints: number;
  seasonsPlayed: number;
  distinctOwners: number;
}

export interface SeasonPointsPoint {
  year: number;
  points: number;
}

const CAREER_SQL = `
  SELECT p.full_name, p.position, p.nfl_team,
         fs.year AS first_year, ls.year AS last_year
  FROM players p
  LEFT JOIN seasons fs ON fs.id = p.first_season_id
  LEFT JOIN seasons ls ON ls.id = p.last_season_id
  WHERE p.espn_player_id = @playerId
`;

const TENURE_SQL = `
  SELECT s.year AS year,
         t.id AS team_id,
         t.name AS name,
         t.abbrev AS abbrev,
         t.color AS color,
         t.owner_name AS owner_name,
         o.id AS owner_id,
         o.alias_num AS owner_alias_num,
         COUNT(DISTINCT w.week_num) AS weeks,
         SUM(r.points) AS total_points,
         SUM(CASE WHEN r.lineup_slot NOT IN ('BN', 'IR') THEN 1 ELSE 0 END) AS starts,
         SUM(CASE WHEN r.lineup_slot = 'BN' THEN 1 ELSE 0 END) AS benches
  FROM rosters r
  JOIN weeks w ON w.id = r.week_id
  JOIN seasons s ON s.id = w.season_id
  JOIN teams t ON t.id = r.team_id
  LEFT JOIN owners o ON o.id = t.owner_id
  WHERE r.espn_player_id = @playerId
  GROUP BY s.year, t.id
  ORDER BY s.year ASC, t.id ASC
`;

/**
 * Public player identity (NFL players are public — no masking). Season ids are
 * not year-ordered, so first/last seasons are resolved to years via the seasons table.
 */
export async function getPlayerCareer(espnPlayerId: number): Promise<PlayerCareer | null> {
  const row = db
    .prepare(CAREER_SQL)
    .get({ playerId: espnPlayerId }) as
    | { full_name: string; position: string; nfl_team: string; first_year: number | null; last_year: number | null }
    | undefined;

  if (!row) return null;

  return {
    fullName: row.full_name,
    position: row.position,
    nflTeam: row.nfl_team,
    firstYear: row.first_year,
    lastYear: row.last_year,
  };
}

/**
 * Per (season year, team) roster tenure for a player. Team/owner identity is masked
 * like every other query; owner_id is retained server-side as the franchise-legend
 * grouping key and is never rendered or sent to a client component.
 */
export async function getPlayerTenure(espnPlayerId: number): Promise<PlayerTenureRow[]> {
  const rows = db
    .prepare(TENURE_SQL)
    .all({ playerId: espnPlayerId }) as Omit<PlayerTenureRow, "key">[];

  const keyed: PlayerTenureRow[] = rows.map((r) => ({ ...r, key: `${r.year}-${r.team_id}` }));

  return maskRows(keyed, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
    abbrev: maskedTeamAbbrev(r.owner_alias_num),
    owner_name: maskedOwnerName(r.owner_alias_num),
  }));
}

/** True when a player spent FRANCHISE_LEGEND_SEASONS+ distinct seasons under one owner. */
export function isFranchiseLegend(tenure: PlayerTenureRow[]): boolean {
  const yearsByOwner = new Map<string, Set<number>>();
  for (const row of tenure) {
    if (row.owner_id == null) continue;
    const years = yearsByOwner.get(row.owner_id) ?? new Set<number>();
    years.add(row.year);
    yearsByOwner.set(row.owner_id, years);
  }
  for (const years of yearsByOwner.values()) {
    if (years.size >= FRANCHISE_LEGEND_SEASONS) return true;
  }
  return false;
}

/** Career aggregates derived from tenure rows. */
export function summarizeCareer(tenure: PlayerTenureRow[]): CareerSummary {
  let totalPoints = 0;
  const years = new Set<number>();
  const owners = new Set<string>();
  for (const row of tenure) {
    totalPoints += row.total_points;
    years.add(row.year);
    if (row.owner_id != null) owners.add(row.owner_id);
  }
  return { totalPoints, seasonsPlayed: years.size, distinctOwners: owners.size };
}

/** Total points per season (collapsing mid-season trades), sorted ascending by year. */
export function pointsBySeason(tenure: PlayerTenureRow[]): SeasonPointsPoint[] {
  const byYear = new Map<number, number>();
  for (const row of tenure) {
    byYear.set(row.year, (byYear.get(row.year) ?? 0) + row.total_points);
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, points]) => ({ year, points: Number(points.toFixed(1)) }));
}

/** Human-readable career span, e.g. "2018–2024", "2020", or "—" when unknown. */
export function careerSpan(firstYear: number | null, lastYear: number | null): string {
  const years = [firstYear, lastYear].filter((y): y is number => y != null);
  if (years.length === 0) return "—";
  const start = Math.min(...years);
  const end = Math.max(...years);
  return start === end ? String(start) : `${start}–${end}`;
}
