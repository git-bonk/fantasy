import { db } from "../db";
import type { TransactionRow } from "../types";
import { maskRows, maskedTeamName } from "./shared";

export interface TransactionFeedRow extends TransactionRow {
  team_id: number | null;
  player_id: number | null;
}

export async function getTransactions(seasonId: number): Promise<TransactionFeedRow[]> {
  const rows = db
    .prepare(
      `SELECT tx.type, tx.player_name, tx.week_num, w.label AS week_label,
              COALESCE(tx.bid_amount, eb.bid_amount) AS bid_amount,
              t.id AS team_id, t.name tname, t.color, o.alias_num AS owner_alias_num,
              pp.id AS player_id
       FROM transactions tx
       JOIN weeks w ON w.season_id = tx.season_id AND w.week_num = tx.week_num
       LEFT JOIN teams t ON t.id = tx.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       LEFT JOIN players pp ON pp.espn_player_id = tx.espn_player_id
       LEFT JOIN (
         SELECT team_id, espn_player_id, MAX(bid_amount) AS bid_amount
         FROM transactions
         WHERE season_id = ? AND source = 'espn' AND bid_amount IS NOT NULL
         GROUP BY team_id, espn_player_id
       ) eb ON eb.team_id = tx.team_id AND eb.espn_player_id = tx.espn_player_id
       WHERE tx.season_id = ? AND tx.source = 'derived'
       ORDER BY tx.week_num DESC, tx.id`
    )
    .all(seasonId, seasonId) as TransactionFeedRow[];

  return maskRows(rows, (r) => ({
    tname: r.tname === null ? null : maskedTeamName(r.owner_alias_num),
  }));
}
