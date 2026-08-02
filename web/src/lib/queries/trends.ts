import { db } from "../db";
import { getRevealState } from "../reveal";
import type { TeamTrendRow, TrendRow } from "../types";
import { maskRows, maskedTeamAbbrev, maskedTeamName } from "./shared";

export function getLeagueTrend(seasonId: number): TrendRow[] {
  return db
    .prepare(
      `SELECT w.week_num, AVG(score) avg_pts FROM (
         SELECT w.week_num, m.home_score score
         FROM matchups m JOIN weeks w ON w.id = m.week_id
         WHERE w.season_id = ?
         UNION ALL
         SELECT w.week_num, m.away_score
         FROM matchups m JOIN weeks w ON w.id = m.week_id
         WHERE w.season_id = ?
       ) sub JOIN weeks w ON w.week_num = sub.week_num AND w.season_id = ?
       GROUP BY w.week_num ORDER BY w.week_num`
    )
    .all(seasonId, seasonId, seasonId) as TrendRow[];
}

export async function getTeamTrends(seasonId: number): Promise<TeamTrendRow[]> {
  const rows = db
    .prepare(
      `SELECT w.week_num, t.id team_id, t.name, t.color, sub.points,
              o.alias_num AS owner_alias_num FROM (
         SELECT m.week_id, m.home_team_id team_id, m.home_score points FROM matchups m
         JOIN weeks w2 ON w2.id = m.week_id WHERE w2.season_id = ?
         UNION ALL
         SELECT m.week_id, m.away_team_id, m.away_score FROM matchups m
         JOIN weeks w2 ON w2.id = m.week_id WHERE w2.season_id = ?
       ) sub
       JOIN weeks w ON w.id = sub.week_id
       JOIN teams t ON t.id = sub.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       ORDER BY w.week_num`
    )
    .all(seasonId, seasonId) as TeamTrendRow[];

  return maskRows(rows, (r) => ({
    name: maskedTeamName(r.owner_alias_num),
  }));
}

export async function getStreaks(seasonId: number, weekNum?: number) {
  const revealed = await getRevealState();
  const asOf = weekNum !== undefined ? "AND w.week_num <= ?" : "";
  const params = weekNum !== undefined ? [seasonId, weekNum] : [seasonId];
  const matchups = db
    .prepare(
      `SELECT w.week_num, m.home_team_id, m.away_team_id, m.winner_team_id
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       WHERE w.season_id = ? AND w.is_playoff = 0 ${asOf}
       ORDER BY w.week_num`
    )
    .all(...params) as {
    week_num: number;
    home_team_id: number;
    away_team_id: number;
    winner_team_id: number | null;
  }[];

  const teams = db
    .prepare(
      `SELECT t.id, t.name, t.color, o.alias_num AS owner_alias_num
       FROM teams t LEFT JOIN owners o ON o.id = t.owner_id
       WHERE t.season_id = ?`
    )
    .all(seasonId) as {
    id: number;
    name: string;
    color: string;
    owner_alias_num: number | null;
  }[];

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const streaks: { team_id: number; name: string; color: string; streak: number; type: "W" | "L" }[] =
    [];

  for (const team of teams) {
    let currentStreak = 0;
    let currentType: "W" | "L" | null = null;

    const teamGames = matchups
      .filter((m) => m.home_team_id === team.id || m.away_team_id === team.id)
      .sort((a, b) => a.week_num - b.week_num);

    for (const game of teamGames) {
      if (game.winner_team_id === null) continue;

      const result: "W" | "L" = game.winner_team_id === team.id ? "W" : "L";

      if (currentType === null) {
        currentType = result;
        currentStreak = 1;
      } else if (result === currentType) {
        currentStreak++;
      } else {
        currentType = result;
        currentStreak = 1;
      }
    }

    if (currentType && currentStreak >= 2) {
      const info = teamMap.get(team.id);
      streaks.push({
        team_id: team.id,
        name: revealed ? info?.name ?? "" : maskedTeamName(info?.owner_alias_num),
        color: info?.color ?? "#888",
        streak: currentStreak,
        type: currentType,
      });
    }
  }

  return streaks.sort((a, b) => b.streak - a.streak);
}

export async function getHeadToHead(seasonId: number) {
  const revealed = await getRevealState();
  const matchups = db
    .prepare(
      `SELECT m.home_team_id, m.away_team_id, m.winner_team_id
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       WHERE w.season_id = ? AND w.is_playoff = 0`
    )
    .all(seasonId) as {
    home_team_id: number;
    away_team_id: number;
    winner_team_id: number | null;
  }[];

  const teamRows = db
    .prepare(
      `SELECT t.id, t.name, t.abbrev, t.color, o.alias_num AS owner_alias_num
       FROM teams t LEFT JOIN owners o ON o.id = t.owner_id
       WHERE t.season_id = ? ORDER BY t.id`
    )
    .all(seasonId) as {
    id: number;
    name: string;
    abbrev: string;
    color: string;
    owner_alias_num: number | null;
  }[];

  const teams = teamRows.map((t) =>
    revealed
      ? { id: t.id, name: t.name, abbrev: t.abbrev, color: t.color }
      : {
          id: t.id,
          name: maskedTeamName(t.owner_alias_num),
          abbrev: maskedTeamAbbrev(t.owner_alias_num),
          color: t.color,
        }
  );

  const matrix = new Map<string, { wins: number; losses: number }>();

  for (const m of matchups) {
    const hKey = `${m.home_team_id}-${m.away_team_id}`;
    const aKey = `${m.away_team_id}-${m.home_team_id}`;

    if (!matrix.has(hKey)) matrix.set(hKey, { wins: 0, losses: 0 });
    if (!matrix.has(aKey)) matrix.set(aKey, { wins: 0, losses: 0 });

    if (m.winner_team_id === m.home_team_id) {
      matrix.get(hKey)!.wins++;
      matrix.get(aKey)!.losses++;
    } else if (m.winner_team_id === m.away_team_id) {
      matrix.get(aKey)!.wins++;
      matrix.get(hKey)!.losses++;
    }
  }

  return { teams, matrix };
}
