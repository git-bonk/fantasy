import { db } from "../db";
import { maskRows, maskedTeamName } from "./shared";

export interface TradePlayer {
  pid: number;
  name: string;
  position: string;
}

interface TradeGradeDbRow {
  week_num: number;
  week_label: string;
  team_a_id: number;
  team_b_id: number;
  tname_a: string;
  tname_b: string;
  color_a: string;
  color_b: string;
  alias_a: number | null;
  alias_b: number | null;
  a_players_json: string;
  b_players_json: string;
  a_points: number | null;
  b_points: number | null;
  winner_side: string | null;
  weeks_evaluated: number;
  finalized: number;
}

export interface TradeGradeRow {
  week_num: number;
  week_label: string;
  team_a_id: number;
  team_b_id: number;
  tname_a: string;
  tname_b: string;
  color_a: string;
  color_b: string;
  alias_a: number | null;
  alias_b: number | null;
  a_players: TradePlayer[];
  b_players: TradePlayer[];
  a_points: number | null;
  b_points: number | null;
  winner_side: "A" | "B" | null;
  weeks_evaluated: number;
  finalized: boolean;
}

function isTradePlayer(value: unknown): value is TradePlayer {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.pid === "number" && typeof v.name === "string" && typeof v.position === "string"
  );
}

/** Parse a stored [{pid,name,position}] list, tolerating malformed JSON payloads. */
function parsePlayers(jsonText: string): TradePlayer[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isTradePlayer);
}

function winnerSide(value: string | null): "A" | "B" | null {
  if (value === "A" || value === "B") return value;
  return null;
}

export async function getTradeGrades(seasonId: number): Promise<TradeGradeRow[]> {
  const rows = db
    .prepare(
      `SELECT tr.week_num, w.label AS week_label, tr.team_a_id, tr.team_b_id,
              ta.name AS tname_a, tb.name AS tname_b,
              ta.color AS color_a, tb.color AS color_b,
              oa.alias_num AS alias_a, ob.alias_num AS alias_b,
              tr.a_players_json, tr.b_players_json,
              tr.a_points, tr.b_points, tr.winner_side,
              tr.weeks_evaluated, tr.finalized
       FROM trades tr
       JOIN weeks w ON w.season_id = tr.season_id AND w.week_num = tr.week_num
       JOIN teams ta ON ta.id = tr.team_a_id
       JOIN teams tb ON tb.id = tr.team_b_id
       LEFT JOIN owners oa ON oa.id = ta.owner_id
       LEFT JOIN owners ob ON ob.id = tb.owner_id
       WHERE tr.season_id = @seasonId
       ORDER BY tr.week_num DESC, tr.team_a_id, tr.team_b_id`
    )
    .all({ seasonId }) as TradeGradeDbRow[];

  // Both team names are identity-bearing; mask each via its own owner alias.
  const masked = await maskRows(rows, (r) => ({
    tname_a: maskedTeamName(r.alias_a),
    tname_b: maskedTeamName(r.alias_b),
  }));

  return masked.map((r) => ({
    week_num: r.week_num,
    week_label: r.week_label,
    team_a_id: r.team_a_id,
    team_b_id: r.team_b_id,
    tname_a: r.tname_a,
    tname_b: r.tname_b,
    color_a: r.color_a,
    color_b: r.color_b,
    alias_a: r.alias_a,
    alias_b: r.alias_b,
    a_players: parsePlayers(r.a_players_json),
    b_players: parsePlayers(r.b_players_json),
    a_points: r.a_points,
    b_points: r.b_points,
    winner_side: winnerSide(r.winner_side),
    weeks_evaluated: r.weeks_evaluated,
    finalized: r.finalized === 1,
  }));
}
