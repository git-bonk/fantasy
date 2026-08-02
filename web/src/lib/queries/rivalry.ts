import { db } from "../db";
import type { RivalryGameRow } from "../types";

export function getRivalryGames(seasonId: number, a: number, b: number): RivalryGameRow[] {
  return db
    .prepare(
      `SELECT m.id, w.week_num, w.label, w.is_playoff,
              m.home_team_id, m.away_team_id, m.home_score, m.away_score, m.winner_team_id
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       WHERE w.season_id = ?
         AND ((m.home_team_id = ? AND m.away_team_id = ?)
           OR (m.home_team_id = ? AND m.away_team_id = ?))
       ORDER BY w.week_num`
    )
    .all(seasonId, a, b, b, a) as RivalryGameRow[];
}
