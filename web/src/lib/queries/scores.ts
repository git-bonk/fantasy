import { db } from "../db";
import type { BracketGameRow, MatchupRow, PredictMatchupRow } from "../types";
import { maskRows, maskedTeamAbbrev, maskedTeamName } from "./shared";

export async function getMatchups(seasonId: number, weekNum: number): Promise<MatchupRow[]> {
  const rows = db
    .prepare(
      `SELECT m.id, m.home_score, m.away_score, m.winner_team_id, w.is_playoff,
              th.id hid, th.name hname, th.abbrev habb, th.color hcolor,
              oh.alias_num AS h_owner_alias_num,
              ta.id aid, ta.name aname, ta.abbrev aabb, ta.color acolor,
              oa.alias_num AS a_owner_alias_num
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       JOIN teams th ON th.id = m.home_team_id
       LEFT JOIN owners oh ON oh.id = th.owner_id
       JOIN teams ta ON ta.id = m.away_team_id
       LEFT JOIN owners oa ON oa.id = ta.owner_id
       WHERE w.season_id = ? AND w.week_num = ?`
    )
    .all(seasonId, weekNum) as MatchupRow[];

  return maskRows(rows, (r) => ({
    hname: maskedTeamName(r.h_owner_alias_num),
    habb: maskedTeamAbbrev(r.h_owner_alias_num),
    aname: maskedTeamName(r.a_owner_alias_num),
    aabb: maskedTeamAbbrev(r.a_owner_alias_num),
  }));
}

export async function getPredictData(
  seasonId: number,
  weekNum: number
): Promise<PredictMatchupRow[]> {
  const rows = db
    .prepare(
      `SELECT m.id, m.home_score, m.away_score, m.winner_team_id,
              th.id hid, th.name hname, th.abbrev habb, th.color hcolor,
              oh.alias_num AS h_owner_alias_num,
              eh.rating h_elo,
              ta.id aid, ta.name aname, ta.abbrev aabb, ta.color acolor,
              oa.alias_num AS a_owner_alias_num,
              ea.rating a_elo
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       JOIN teams th ON th.id = m.home_team_id
       LEFT JOIN owners oh ON oh.id = th.owner_id
       JOIN teams ta ON ta.id = m.away_team_id
       LEFT JOIN owners oa ON oa.id = ta.owner_id
       LEFT JOIN elo_ratings eh ON eh.season_id = ? AND eh.team_id = m.home_team_id AND eh.week_num = ? - 1
       LEFT JOIN elo_ratings ea ON ea.season_id = ? AND ea.team_id = m.away_team_id AND ea.week_num = ? - 1
       WHERE w.season_id = ? AND w.week_num = ?`
    )
    .all(seasonId, weekNum, seasonId, weekNum, seasonId, weekNum) as PredictMatchupRow[];

  return maskRows(rows, (r) => ({
    hname: maskedTeamName(r.h_owner_alias_num),
    habb: maskedTeamAbbrev(r.h_owner_alias_num),
    aname: maskedTeamName(r.a_owner_alias_num),
    aabb: maskedTeamAbbrev(r.a_owner_alias_num),
  }));
}

export async function getPlayoffBracket(seasonId: number): Promise<BracketGameRow[]> {
  const rows = db
    .prepare(
      `SELECT m.id, m.home_score, m.away_score, m.winner_team_id, w.is_playoff,
              m.playoff_tier, w.week_num, w.label,
              th.id hid, th.name hname, th.abbrev habb, th.color hcolor,
              oh.alias_num AS h_owner_alias_num,
              ta.id aid, ta.name aname, ta.abbrev aabb, ta.color acolor,
              oa.alias_num AS a_owner_alias_num
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       JOIN teams th ON th.id = m.home_team_id
       LEFT JOIN owners oh ON oh.id = th.owner_id
       JOIN teams ta ON ta.id = m.away_team_id
       LEFT JOIN owners oa ON oa.id = ta.owner_id
       WHERE w.season_id = ? AND m.is_playoff = 1
       ORDER BY w.week_num`
    )
    .all(seasonId) as BracketGameRow[];

  return maskRows(rows, (r) => ({
    hname: maskedTeamName(r.h_owner_alias_num),
    habb: maskedTeamAbbrev(r.h_owner_alias_num),
    aname: maskedTeamName(r.a_owner_alias_num),
    aabb: maskedTeamAbbrev(r.a_owner_alias_num),
  }));
}
