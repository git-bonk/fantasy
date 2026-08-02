import { db } from "../db";
import { matchupKey, winProbability } from "../prediction-math";
import type {
  PickDistributionRow,
  PickableRow,
  PredictionLeaderboardRow,
} from "../types";
import { getEloAtWeek } from "./recap-data";
import { maskRows, maskedOwnerName, maskedTeamAbbrev, maskedTeamName } from "./shared";

export { matchupKey, winProbability };

interface RawPickable {
  matchup_key: string;
  kickoff: string | null;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: number | null;
  hid: number;
  hname: string;
  habb: string;
  hcolor: string;
  h_alias: number | null;
  aid: number;
  aname: string;
  aabb: string;
  acolor: string;
  a_alias: number | null;
}

export async function getWeekPickables(
  seasonId: number,
  weekNum: number
): Promise<PickableRow[]> {
  const rows = db
    .prepare(
      `WITH pairings AS (
         SELECT sm.home_team_id AS home_team_id, sm.away_team_id AS away_team_id,
                sm.kickoff AS kickoff, w.id AS week_id
         FROM scheduled_matchups sm
         LEFT JOIN weeks w ON w.season_id = sm.season_id AND w.week_num = sm.week_num
         WHERE sm.season_id = @seasonId AND sm.week_num = @weekNum
         UNION
         SELECT m.home_team_id, m.away_team_id, NULL, m.week_id
         FROM matchups m JOIN weeks w ON w.id = m.week_id
         WHERE w.season_id = @seasonId AND w.week_num = @weekNum
           AND NOT EXISTS (
             SELECT 1 FROM scheduled_matchups sm2
             WHERE sm2.season_id = @seasonId AND sm2.week_num = @weekNum
           )
       )
       SELECT MIN(p.home_team_id, p.away_team_id) || '-' || MAX(p.home_team_id, p.away_team_id) AS matchup_key,
              p.kickoff AS kickoff,
              CASE WHEN m.home_team_id = p.home_team_id THEN m.home_score ELSE m.away_score END AS home_score,
              CASE WHEN m.home_team_id = p.home_team_id THEN m.away_score ELSE m.home_score END AS away_score,
              m.winner_team_id AS winner_team_id,
              th.id AS hid, th.name AS hname, th.abbrev AS habb, th.color AS hcolor,
              ho.alias_num AS h_alias,
              ta.id AS aid, ta.name AS aname, ta.abbrev AS aabb, ta.color AS acolor,
              ao.alias_num AS a_alias
       FROM pairings p
       JOIN teams th ON th.id = p.home_team_id
       JOIN teams ta ON ta.id = p.away_team_id
       LEFT JOIN owners ho ON ho.id = th.owner_id
       LEFT JOIN owners ao ON ao.id = ta.owner_id
       LEFT JOIN matchups m ON m.week_id = p.week_id
         AND ((m.home_team_id = p.home_team_id AND m.away_team_id = p.away_team_id)
           OR (m.home_team_id = p.away_team_id AND m.away_team_id = p.home_team_id))`
    )
    .all({ seasonId, weekNum }) as RawPickable[];

  const elo = new Map(getEloAtWeek(seasonId, weekNum - 1).map((e) => [e.team_id, e.rating]));

  const withProb: PickableRow[] = rows.map((r) => {
    const he = elo.get(r.hid);
    const ae = elo.get(r.aid);
    return { ...r, prob: he != null && ae != null ? winProbability(he, ae) : null };
  });

  return maskRows(withProb, (r) => ({
    hname: maskedTeamName(r.h_alias),
    habb: maskedTeamAbbrev(r.h_alias),
    aname: maskedTeamName(r.a_alias),
    aabb: maskedTeamAbbrev(r.a_alias),
  }));
}

export function getScheduledWeeks(seasonId: number): number[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT week_num FROM scheduled_matchups WHERE season_id = ? ORDER BY week_num`
    )
    .all(seasonId) as { week_num: number }[];
  return rows.map((r) => r.week_num);
}

export function getMyPicks(
  ownerId: string,
  seasonId: number,
  weekNum: number
): Map<string, number | null> {
  const rows = db
    .prepare(
      `SELECT matchup_key, picked_team_id FROM predictions
       WHERE owner_id = ? AND season_id = ? AND week_num = ?`
    )
    .all(ownerId, seasonId, weekNum) as { matchup_key: string; picked_team_id: number | null }[];
  return new Map(rows.map((r) => [r.matchup_key, r.picked_team_id]));
}

interface ScoredPick {
  owner_id: string;
  alias_num: number | null;
  display_name: string;
  week_num: number;
  picked_team_id: number;
  winner_team_id: number;
}

export async function getPredictionLeaderboard(
  seasonId: number
): Promise<PredictionLeaderboardRow[]> {
  const rows = db
    .prepare(
      `SELECT p.owner_id AS owner_id, o.alias_num AS alias_num, o.display_name AS display_name,
              p.week_num AS week_num, p.picked_team_id AS picked_team_id,
              m.winner_team_id AS winner_team_id
       FROM predictions p
       JOIN owners o ON o.id = p.owner_id
       JOIN weeks w ON w.season_id = p.season_id AND w.week_num = p.week_num
       JOIN matchups m ON m.week_id = w.id
         AND (MIN(m.home_team_id, m.away_team_id) || '-' || MAX(m.home_team_id, m.away_team_id)) = p.matchup_key
       WHERE p.season_id = ? AND p.picked_team_id IS NOT NULL AND m.winner_team_id IS NOT NULL
       ORDER BY p.owner_id, p.week_num`
    )
    .all(seasonId) as ScoredPick[];

  const byOwner = new Map<string, ScoredPick[]>();
  for (const r of rows) {
    const list = byOwner.get(r.owner_id) ?? [];
    list.push(r);
    byOwner.set(r.owner_id, list);
  }

  const aggregated: PredictionLeaderboardRow[] = [...byOwner.entries()].map(([ownerId, picks]) => {
    const total = picks.length;
    const correct = picks.filter((p) => p.picked_team_id === p.winner_team_id).length;
    let streak = 0;
    for (let i = picks.length - 1; i >= 0; i--) {
      if (picks[i].picked_team_id === picks[i].winner_team_id) streak += 1;
      else break;
    }
    const first = picks[0];
    return {
      owner_id: ownerId,
      alias_num: first.alias_num,
      display_name: first.display_name,
      correct,
      total,
      points: correct,
      streak,
    };
  });

  aggregated.sort(
    (a, b) => b.correct - a.correct || a.total - b.total || (a.alias_num ?? 0) - (b.alias_num ?? 0)
  );

  return maskRows(aggregated, (r) => ({ display_name: maskedOwnerName(r.alias_num) }));
}

export async function getPickDistribution(
  seasonId: number,
  weekNum: number,
  key: string
): Promise<PickDistributionRow[]> {
  const rows = db
    .prepare(
      `SELECT p.picked_team_id AS team_id, t.abbrev AS abbrev, t.color AS color,
              o.alias_num AS alias_num, COUNT(*) AS count
       FROM predictions p
       JOIN teams t ON t.id = p.picked_team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       WHERE p.season_id = ? AND p.week_num = ? AND p.matchup_key = ? AND p.picked_team_id IS NOT NULL
       GROUP BY p.picked_team_id
       ORDER BY count DESC`
    )
    .all(seasonId, weekNum, key) as PickDistributionRow[];
  return maskRows(rows, (r) => ({ abbrev: maskedTeamAbbrev(r.alias_num) }));
}
