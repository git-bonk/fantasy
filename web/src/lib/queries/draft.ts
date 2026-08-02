import { db } from "../db";
import { maskRows, maskedTeamAbbrev, maskedTeamName } from "./shared";

export interface DraftPickRow {
  id: number;
  round_num: number;
  round_pick: number;
  overall_pick: number | null;
  espn_player_id: number | null;
  player_name: string;
  position: string;
  nfl_team: string | null;
  bid_amount: number | null;
  keeper_status: number;
  team_id: number | null;
  tname: string | null;
  abbrev: string | null;
  color: string | null;
  owner_alias_num: number | null;
}

export interface DraftValuePick {
  team_id: number;
  tname: string;
  color: string | null;
  owner_alias_num: number | null;
  player_name: string;
  position: string;
  round_num: number;
  round_pick: number;
  produced: number;
}

export interface RoundValue {
  round_num: number;
  avg_produced: number;
  picks: number;
}

export interface TeamPickValue {
  team_id: number;
  tname: string;
  color: string | null;
  owner_alias_num: number | null;
  player_name: string;
  position: string;
  round_num: number;
  produced: number;
  value_over_round: number;
}

export interface TeamBestWorst {
  team_id: number;
  tname: string;
  color: string | null;
  owner_alias_num: number | null;
  best: TeamPickValue;
  worst: TeamPickValue;
}

/**
 * Full draft board for a season: picks joined to teams (and owners for masking),
 * ordered round-by-round. Team names are masked like every other query; NFL player
 * names are public.
 */
export async function getDraft(seasonId: number): Promise<DraftPickRow[]> {
  const rows = db
    .prepare(
      `SELECT d.id, d.round_num, d.round_pick, d.overall_pick, d.espn_player_id,
              d.player_name, d.position, d.nfl_team, d.bid_amount, d.keeper_status,
              t.id AS team_id, t.name AS tname, t.abbrev AS abbrev,
              t.color AS color, o.alias_num AS owner_alias_num
       FROM draft_picks d
       JOIN teams t ON t.id = d.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       WHERE d.season_id = @seasonId
       ORDER BY d.round_num, d.round_pick`
    )
    .all({ seasonId }) as DraftPickRow[];

  return maskRows(rows, (r) => ({
    tname: r.tname === null ? null : maskedTeamName(r.owner_alias_num),
    abbrev: r.abbrev === null ? null : maskedTeamAbbrev(r.owner_alias_num),
  }));
}

/**
 * Per-pick season production: the total points each drafted player scored for the
 * team that drafted them (SUM of rosters.points by player + team that season).
 * Feeds the pure best/worst and round-value helpers below.
 */
export async function getDraftValue(seasonId: number): Promise<DraftValuePick[]> {
  const rows = db
    .prepare(
      `SELECT d.team_id, d.player_name, d.position, d.round_num, d.round_pick,
              t.name AS tname, t.color AS color, o.alias_num AS owner_alias_num,
              COALESCE((
                SELECT SUM(r.points)
                FROM rosters r
                JOIN weeks w ON w.id = r.week_id
                WHERE w.season_id = @seasonId
                  AND r.team_id = d.team_id
                  AND r.espn_player_id = d.espn_player_id
              ), 0) AS produced
       FROM draft_picks d
       JOIN teams t ON t.id = d.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       WHERE d.season_id = @seasonId AND d.espn_player_id IS NOT NULL
       ORDER BY d.round_num, d.round_pick`
    )
    .all({ seasonId }) as DraftValuePick[];

  return maskRows(rows, (r) => ({
    tname: maskedTeamName(r.owner_alias_num),
  }));
}

/** Average points produced per pick for each round, in ascending round order. */
export function roundValues(picks: DraftValuePick[]): RoundValue[] {
  const byRound = new Map<number, { total: number; count: number }>();
  for (const p of picks) {
    const agg = byRound.get(p.round_num) ?? { total: 0, count: 0 };
    agg.total += p.produced;
    agg.count += 1;
    byRound.set(p.round_num, agg);
  }
  return [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round_num, { total, count }]) => ({
      round_num,
      avg_produced: count > 0 ? total / count : 0,
      picks: count,
    }));
}

/** Points a pick produced above (or below) its round's average — "value vs round". */
export function valueOverRound(produced: number, roundAverage: number): number {
  return produced - roundAverage;
}

/**
 * Per-team best and worst pick, ranked by value over the round average (so a late
 * round steal beats an early round bust). Teams are ordered by best-pick value.
 */
export function teamBestWorst(picks: DraftValuePick[]): TeamBestWorst[] {
  const averages = new Map(roundValues(picks).map((r) => [r.round_num, r.avg_produced]));
  const enriched: TeamPickValue[] = picks.map((p) => ({
    team_id: p.team_id,
    tname: p.tname,
    color: p.color,
    owner_alias_num: p.owner_alias_num,
    player_name: p.player_name,
    position: p.position,
    round_num: p.round_num,
    produced: p.produced,
    value_over_round: valueOverRound(p.produced, averages.get(p.round_num) ?? 0),
  }));

  const byTeam = new Map<number, TeamPickValue[]>();
  for (const p of enriched) {
    const list = byTeam.get(p.team_id) ?? [];
    list.push(p);
    byTeam.set(p.team_id, list);
  }

  const out: TeamBestWorst[] = [];
  for (const [team_id, list] of byTeam) {
    const sorted = [...list].sort((a, b) => b.value_over_round - a.value_over_round);
    out.push({
      team_id,
      tname: list[0].tname,
      color: list[0].color,
      owner_alias_num: list[0].owner_alias_num,
      best: sorted[0],
      worst: sorted[sorted.length - 1],
    });
  }
  return out.sort((a, b) => b.best.value_over_round - a.best.value_over_round);
}
