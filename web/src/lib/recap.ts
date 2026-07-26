import { getEloAtWeek, getPredictData, getSeasonMatchups, getWeeks } from "./queries";
import type { MatchupTag, PredictMatchupRow, RecapMatchupRow, SeasonMatchupRow } from "./types";

const TAG_THRESHOLDS = {
  nailBiterMargin: 5,
  blowoutMargin: 30,
  statementMargin: 15,
  statementTopN: 4,
  bustFraction: 0.85,
};

interface TagContext {
  weeklyAvg: number;
  maxCombined: number;
  topTeams: Set<number>;
  earlier: SeasonMatchupRow[];
}

function computeTag(m: PredictMatchupRow, ctx: TagContext): MatchupTag | null {
  if (m.winner_team_id === null) return null;

  const winnerIsHome = m.winner_team_id === m.hid;
  const winnerScore = winnerIsHome ? m.home_score : m.away_score;
  const loserScore = winnerIsHome ? m.away_score : m.home_score;
  const winnerElo = winnerIsHome ? m.h_elo : m.a_elo;
  const loserElo = winnerIsHome ? m.a_elo : m.h_elo;
  const margin = winnerScore - loserScore;
  const combinedTotal = m.home_score + m.away_score;

  if (winnerElo !== null && loserElo !== null && winnerElo < loserElo) return "UPSET";

  if (margin <= TAG_THRESHOLDS.nailBiterMargin) return "NAIL_BITER";

  if (margin >= TAG_THRESHOLDS.blowoutMargin) return "BLOWOUT";

  if (
    ctx.topTeams.has(m.hid) &&
    ctx.topTeams.has(m.aid) &&
    margin >= TAG_THRESHOLDS.statementMargin
  ) {
    return "STATEMENT";
  }

  const earlierMeeting = ctx.earlier.find(
    (g) =>
      (g.home_team_id === m.hid && g.away_team_id === m.aid) ||
      (g.home_team_id === m.aid && g.away_team_id === m.hid)
  );
  if (
    earlierMeeting &&
    earlierMeeting.winner_team_id !== null &&
    earlierMeeting.winner_team_id !== m.winner_team_id
  ) {
    return "REVENGE";
  }

  if (winnerScore < TAG_THRESHOLDS.bustFraction * ctx.weeklyAvg) return "BUST";

  if (combinedTotal >= ctx.maxCombined) return "SHOOTOUT";

  return null;
}

export async function getRecapMatchups(
  seasonId: number,
  weekNum: number
): Promise<RecapMatchupRow[]> {
  const matchups = await getPredictData(seasonId, weekNum);
  if (matchups.length === 0) return [];

  const allScores = matchups.flatMap((m) => [m.home_score, m.away_score]);
  const weeklyAvg = allScores.reduce((sum, s) => sum + s, 0) / allScores.length;
  const maxCombined = Math.max(...matchups.map((m) => m.home_score + m.away_score));

  const topTeams = new Set(
    [...getEloAtWeek(seasonId, weekNum - 1)]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, TAG_THRESHOLDS.statementTopN)
      .map((e) => e.team_id)
  );

  const earlier = getSeasonMatchups(seasonId).filter((g) => g.week_num < weekNum);
  const isPlayoff = getWeeks(seasonId).find((w) => w.week_num === weekNum)?.is_playoff ?? 0;

  const ctx: TagContext = { weeklyAvg, maxCombined, topTeams, earlier };

  return matchups.map((m) => ({
    id: m.id,
    home_score: m.home_score,
    away_score: m.away_score,
    winner_team_id: m.winner_team_id,
    is_playoff: isPlayoff,
    hid: m.hid,
    hname: m.hname,
    habb: m.habb,
    hcolor: m.hcolor,
    aid: m.aid,
    aname: m.aname,
    aabb: m.aabb,
    acolor: m.acolor,
    tag: computeTag(m, ctx),
  }));
}
