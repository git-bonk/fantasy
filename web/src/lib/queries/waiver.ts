import { db } from "../db";
import { maskRows, maskedTeamName } from "./shared";

export interface WaiverLeaderRow {
  team_id: number;
  tname: string;
  color: string;
  owner_alias_num: number | null;
  gems: number;
  regrets: number;
  net: number;
}

export interface TopMoveRow {
  player_name: string;
  move_type: "ADD" | "DROP";
  week_num: number;
  points_after: number;
  team_id: number;
  tname: string;
  color: string;
  owner_alias_num: number | null;
}

export interface TopMoves {
  gems: TopMoveRow[];
  regrets: TopMoveRow[];
}

const TOP_MOVES_SQL = `
  SELECT wi.player_name, wi.move_type, wi.week_num, wi.points_after,
         t.id AS team_id, t.name AS tname, t.color, o.alias_num AS owner_alias_num
  FROM waiver_impact wi
  JOIN teams t ON t.id = wi.team_id
  LEFT JOIN owners o ON o.id = t.owner_id
  WHERE wi.season_id = @seasonId AND wi.label = @label
  ORDER BY wi.points_after DESC, wi.week_num
  LIMIT @limit
`;

/** Per-owner waiver scorecard: gem pickups, regret drops, and net points impact. */
export async function getWaiverLeaderboard(seasonId: number): Promise<WaiverLeaderRow[]> {
  const rows = db
    .prepare(
      `SELECT t.id AS team_id, t.name AS tname, t.color, o.alias_num AS owner_alias_num,
              SUM(CASE wi.label WHEN 'GEM' THEN 1 ELSE 0 END) AS gems,
              SUM(CASE wi.label WHEN 'REGRET' THEN 1 ELSE 0 END) AS regrets,
              SUM(CASE wi.move_type WHEN 'ADD' THEN wi.points_after
                                    ELSE -wi.points_after END) AS net
       FROM waiver_impact wi
       JOIN teams t ON t.id = wi.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       WHERE wi.season_id = @seasonId
       GROUP BY o.id, t.id
       ORDER BY net DESC, regrets ASC`
    )
    .all({ seasonId }) as WaiverLeaderRow[];

  return maskRows(rows, (r) => ({ tname: maskedTeamName(r.owner_alias_num) }));
}

/** Top stolen gems and regret drops by post-move points. NFL player names are public. */
export async function getTopMoves(seasonId: number, limit = 5): Promise<TopMoves> {
  const stmt = db.prepare(TOP_MOVES_SQL);
  const gems = stmt.all({ seasonId, label: "GEM", limit }) as TopMoveRow[];
  const regrets = stmt.all({ seasonId, label: "REGRET", limit }) as TopMoveRow[];
  return {
    gems: await maskRows(gems, (r) => ({ tname: maskedTeamName(r.owner_alias_num) })),
    regrets: await maskRows(regrets, (r) => ({ tname: maskedTeamName(r.owner_alias_num) })),
  };
}
