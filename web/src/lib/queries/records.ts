import { db } from "../db";
import { getRevealState } from "../reveal";
import type { LuckRow, RecordRow, ShameItem } from "../types";
import { getRecapLuck } from "./recap-data";
import { getMaxRegularWeek } from "./seasons";
import { maskedTeamAbbrev, maskedTeamName } from "./shared";

interface ShameMatchupRow {
  id: number;
  week_num: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  winner_team_id: number | null;
  hname: string;
  habb: string;
  hcolor: string;
  aname: string;
  aabb: string;
  acolor: string;
  h_owner_alias_num: number | null;
  a_owner_alias_num: number | null;
}

export async function getRecords(): Promise<RecordRow[]> {
  const rows = db
    .prepare(
      `SELECT r.*, t.name AS record_team_name, o.alias_num AS owner_alias_num
       FROM records r
       LEFT JOIN teams t ON t.id = r.team_id
       LEFT JOIN owners o ON o.id = t.owner_id
       ORDER BY r.category, r.rank`
    )
    .all() as (RecordRow & { record_team_name: string | null })[];

  const revealed = await getRevealState();
  if (revealed) return rows;

  return rows.map((r) => {
    const { record_team_name, ...rest } = r;
    if (record_team_name === null) return rest;
    const detail =
      rest.detail !== null && rest.detail.startsWith(record_team_name)
        ? maskedTeamName(r.owner_alias_num) + rest.detail.slice(record_team_name.length)
        : rest.detail;
    return { ...rest, detail };
  });
}

export async function getShameData(seasonId: number): Promise<ShameItem[]> {
  const revealed = await getRevealState();
  const rawMatchups = db
    .prepare(
      `SELECT m.id, w.week_num, m.home_team_id, m.away_team_id, m.home_score, m.away_score,
              m.winner_team_id, th.name hname, th.abbrev habb, th.color hcolor,
              oh.alias_num AS h_owner_alias_num,
              ta.name aname, ta.abbrev aabb, ta.color acolor,
              oa.alias_num AS a_owner_alias_num
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       JOIN teams th ON th.id = m.home_team_id
       LEFT JOIN owners oh ON oh.id = th.owner_id
       JOIN teams ta ON ta.id = m.away_team_id
       LEFT JOIN owners oa ON oa.id = ta.owner_id
       WHERE w.season_id = ?
       ORDER BY w.week_num`
    )
    .all(seasonId) as ShameMatchupRow[];

  const matchups = revealed
    ? rawMatchups
    : rawMatchups.map((m) => ({
        ...m,
        hname: maskedTeamName(m.h_owner_alias_num),
        habb: maskedTeamAbbrev(m.h_owner_alias_num),
        aname: maskedTeamName(m.a_owner_alias_num),
        aabb: maskedTeamAbbrev(m.a_owner_alias_num),
      }));

  if (matchups.length === 0) return [];

  const teamInfo = new Map<number, { name: string; abbrev: string; color: string }>();
  for (const m of matchups) {
    teamInfo.set(m.home_team_id, { name: m.hname, abbrev: m.habb, color: m.hcolor });
    teamInfo.set(m.away_team_id, { name: m.aname, abbrev: m.aabb, color: m.acolor });
  }

  const items: ShameItem[] = [];

  let biggestLoss: { margin: number; teamId: number; week: number; oppName: string } | null = null;
  let lowestScore: { score: number; teamId: number; week: number } | null = null;
  let cheapestWin: { score: number; teamId: number; week: number; oppName: string } | null = null;

  for (const m of matchups) {
    const sides = [
      {
        teamId: m.home_team_id,
        score: m.home_score,
        oppName: m.aname,
        oppScore: m.away_score,
      },
      {
        teamId: m.away_team_id,
        score: m.away_score,
        oppName: m.hname,
        oppScore: m.home_score,
      },
    ];

    for (const s of sides) {
      const lossMargin = s.oppScore - s.score;
      if (lossMargin > 0 && (!biggestLoss || lossMargin > biggestLoss.margin)) {
        biggestLoss = { margin: lossMargin, teamId: s.teamId, week: m.week_num, oppName: s.oppName };
      }
      if (!lowestScore || s.score < lowestScore.score) {
        lowestScore = { score: s.score, teamId: s.teamId, week: m.week_num };
      }
      if (m.winner_team_id === s.teamId && (!cheapestWin || s.score < cheapestWin.score)) {
        cheapestWin = { score: s.score, teamId: s.teamId, week: m.week_num, oppName: s.oppName };
      }
    }
  }

  if (biggestLoss) {
    const t = teamInfo.get(biggestLoss.teamId);
    items.push({
      kind: "BIGGEST_LOSS",
      label: "Biggest Loss",
      headline: `${t?.name ?? "Unknown"} lost by ${biggestLoss.margin.toFixed(1)}`,
      value: biggestLoss.margin,
      suffix: "pt loss",
      teamId: biggestLoss.teamId,
      teamName: t?.name ?? "Unknown",
      abbrev: t?.abbrev ?? "—",
      color: t?.color ?? "#888",
      detail: `Week ${biggestLoss.week} vs ${biggestLoss.oppName}`,
    });
  }

  if (lowestScore) {
    const t = teamInfo.get(lowestScore.teamId);
    items.push({
      kind: "LOWEST_SCORE",
      label: "Lowest Score",
      headline: `${t?.name ?? "Unknown"} managed just ${lowestScore.score.toFixed(1)} pts`,
      value: lowestScore.score,
      suffix: "pts",
      teamId: lowestScore.teamId,
      teamName: t?.name ?? "Unknown",
      abbrev: t?.abbrev ?? "—",
      color: t?.color ?? "#888",
      detail: `Week ${lowestScore.week}`,
    });
  }

  let longestSkid: { len: number; teamId: number } | null = null;
  for (const tid of teamInfo.keys()) {
    const games = matchups.filter((m) => m.home_team_id === tid || m.away_team_id === tid);
    let current = 0;
    let best = 0;
    for (const g of games) {
      if (g.winner_team_id === null) {
        current = 0;
        continue;
      }
      if (g.winner_team_id !== tid) {
        current++;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    }
    if (best > 0 && (!longestSkid || best > longestSkid.len)) {
      longestSkid = { len: best, teamId: tid };
    }
  }

  if (longestSkid) {
    const t = teamInfo.get(longestSkid.teamId);
    items.push({
      kind: "LONGEST_LOSING_STREAK",
      label: "Longest Losing Streak",
      headline: `${t?.name ?? "Unknown"} lost ${longestSkid.len} straight`,
      value: longestSkid.len,
      suffix: "straight",
      teamId: longestSkid.teamId,
      teamName: t?.name ?? "Unknown",
      abbrev: t?.abbrev ?? "—",
      color: t?.color ?? "#888",
      detail: "the league's longest skid",
    });
  }

  const luck = await getRecapLuck(seasonId, getMaxRegularWeek(seasonId));
  const unluckiest = luck.reduce<LuckRow | null>(
    (min, l) => (min === null || l.luck_score < min.luck_score ? l : min),
    null
  );
  if (unluckiest && unluckiest.luck_score < 0) {
    const robbed = Math.abs(unluckiest.luck_score);
    items.push({
      kind: "UNLUCKIEST",
      label: "Unluckiest",
      headline: `${unluckiest.name} was robbed ${robbed.toFixed(1)} wins`,
      value: robbed,
      suffix: "wins robbed",
      teamId: unluckiest.id,
      teamName: unluckiest.name,
      abbrev: teamInfo.get(unluckiest.id)?.abbrev ?? "—",
      color: unluckiest.color,
      detail: `expected ${unluckiest.expected_wins.toFixed(1)} wins, got ${unluckiest.actual_wins.toFixed(1)}`,
    });
  }

  if (cheapestWin) {
    const t = teamInfo.get(cheapestWin.teamId);
    items.push({
      kind: "CHEAPEST_WIN",
      label: "Cheapest Win",
      headline: `${t?.name ?? "Unknown"} won with just ${cheapestWin.score.toFixed(1)} pts`,
      value: cheapestWin.score,
      suffix: "pts",
      teamId: cheapestWin.teamId,
      teamName: t?.name ?? "Unknown",
      abbrev: t?.abbrev ?? "—",
      color: t?.color ?? "#888",
      detail: `Week ${cheapestWin.week} vs ${cheapestWin.oppName}`,
    });
  }

  return items;
}
