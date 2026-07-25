import { db } from "./db";
import type {
  BracketGameRow,
  EloHistoryRow,
  LuckRow,
  MatchupRow,
  PlayerRow,
  PlayoffStandingRow,
  PositionLeaders,
  PredictMatchupRow,
  RankingRow,
  RecapAwardRow,
  RecordRow,
  Season,
  SeasonLeaderRow,
  SosRow,
  Team,
  TeamPointsWeekRow,
  TeamRosterRow,
  TeamStandingRow,
  TeamTrendRow,
  TransactionRow,
  TrendRow,
  Week,
} from "./types";

const POSITION_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"];

export function getSeasons(): Season[] {
  return db.prepare("SELECT * FROM seasons ORDER BY year DESC").all() as Season[];
}

export function getLatestSeasonId(): number {
  const row = db.prepare("SELECT id FROM seasons ORDER BY year DESC LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (!row) throw new Error("No seasons found in database");
  return row.id;
}

export function getWeeks(seasonId: number): Week[] {
  return db
    .prepare("SELECT * FROM weeks WHERE season_id = ? ORDER BY week_num")
    .all(seasonId) as Week[];
}

export function getMaxRegularWeek(seasonId: number): number {
  const row = db
    .prepare("SELECT MAX(week_num) as max_week FROM weeks WHERE season_id = ? AND is_playoff = 0")
    .get(seasonId) as { max_week: number | null };
  return row.max_week ?? 14;
}

export function getMaxWeek(seasonId: number): number {
  const row = db
    .prepare("SELECT MAX(week_num) as max_week FROM weeks WHERE season_id = ?")
    .get(seasonId) as { max_week: number | null };
  return row.max_week ?? 17;
}

export function getRankings(seasonId: number): RankingRow[] {
  return db
    .prepare(
      `SELECT t.id, t.name, t.abbrev, t.color, e.rating
       FROM elo_ratings e JOIN teams t ON t.id = e.team_id
       WHERE e.season_id = ? AND e.week_num = (
         SELECT MAX(week_num) FROM weeks WHERE season_id = ? AND is_playoff = 0
       )
       ORDER BY e.rating DESC`
    )
    .all(seasonId, seasonId) as RankingRow[];
}

export function getEloHistory(seasonId: number): EloHistoryRow[] {
  return db
    .prepare(
      `SELECT e.week_num, t.id, t.name, t.color, e.rating
       FROM elo_ratings e JOIN teams t ON t.id = e.team_id
       WHERE e.season_id = ? ORDER BY e.week_num`
    )
    .all(seasonId) as EloHistoryRow[];
}

export function getMatchups(seasonId: number, weekNum: number): MatchupRow[] {
  return db
    .prepare(
      `SELECT m.id, m.home_score, m.away_score, m.winner_team_id, w.is_playoff,
              th.id hid, th.name hname, th.abbrev habb, th.color hcolor,
              ta.id aid, ta.name aname, ta.abbrev aabb, ta.color acolor
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       JOIN teams th ON th.id = m.home_team_id
       JOIN teams ta ON ta.id = m.away_team_id
       WHERE w.season_id = ? AND w.week_num = ?`
    )
    .all(seasonId, weekNum) as MatchupRow[];
}

export function getRecapAwards(seasonId: number, weekNum: number): RecapAwardRow[] {
  return db
    .prepare(
      `SELECT a.type, a.value, a.detail, a.player_name, t.name tname, t.color
       FROM awards a JOIN weeks w ON w.id = a.week_id
       LEFT JOIN teams t ON t.id = a.team_id
       WHERE w.season_id = ? AND w.week_num = ?`
    )
    .all(seasonId, weekNum) as RecapAwardRow[];
}

export function getRecapLuck(seasonId: number, weekNum: number): LuckRow[] {
  return db
    .prepare(
      `SELECT t.id, t.name, t.color, l.actual_wins, l.expected_wins, l.luck_score
       FROM luck l JOIN teams t ON t.id = l.team_id
       WHERE l.season_id = ? AND l.week_num = ?
       ORDER BY l.luck_score DESC`
    )
    .all(seasonId, weekNum) as LuckRow[];
}

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

export function getTeamTrends(seasonId: number): TeamTrendRow[] {
  return db
    .prepare(
      `SELECT w.week_num, t.id team_id, t.name, t.color, sub.points FROM (
         SELECT m.week_id, m.home_team_id team_id, m.home_score points FROM matchups m
         JOIN weeks w2 ON w2.id = m.week_id WHERE w2.season_id = ?
         UNION ALL
         SELECT m.week_id, m.away_team_id, m.away_score FROM matchups m
         JOIN weeks w2 ON w2.id = m.week_id WHERE w2.season_id = ?
       ) sub
       JOIN weeks w ON w.id = sub.week_id
       JOIN teams t ON t.id = sub.team_id
       ORDER BY w.week_num`
    )
    .all(seasonId, seasonId) as TeamTrendRow[];
}

export function getTeams(seasonId: number): TeamStandingRow[] {
  return db
    .prepare(
      `SELECT t.id, t.name, t.abbrev, t.owner_name, t.color, t.logo_url,
              ps.wins, ps.losses, ps.points_for, ps.points_against,
              ps.playoff_seed, ps.playoff_odds
       FROM teams t
       LEFT JOIN playoff_snapshots ps ON ps.team_id = t.id
         AND ps.week_num = (
           SELECT MAX(week_num) FROM playoff_snapshots
           WHERE season_id = t.season_id AND team_id = t.id
         )
       WHERE t.season_id = ?
       ORDER BY ps.playoff_seed IS NULL, ps.playoff_seed, ps.points_for DESC`
    )
    .all(seasonId) as TeamStandingRow[];
}

export function getTeam(seasonId: number, teamId: number): Team | undefined {
  return db
    .prepare("SELECT * FROM teams WHERE season_id = ? AND id = ?")
    .get(seasonId, teamId) as Team | undefined;
}

export function getTeamSos(seasonId: number, teamId: number): SosRow | undefined {
  return db
    .prepare(
      `SELECT opp_avg_points, sos_rank FROM sos
       WHERE season_id = ? AND team_id = ?
       AND week_num = (SELECT MAX(week_num) FROM sos WHERE season_id = ? AND team_id = ?)`
    )
    .get(seasonId, teamId, seasonId, teamId) as SosRow | undefined;
}

export function getTeamRoster(seasonId: number, teamId: number): TeamRosterRow[] {
  return db
    .prepare(
      `SELECT r.player_name, r.position, r.nfl_team, r.lineup_slot, r.points
       FROM rosters r JOIN weeks w ON w.id = r.week_id
       WHERE w.season_id = ? AND r.team_id = ?
         AND w.week_num = (
           SELECT MAX(week_num) FROM weeks WHERE season_id = ? AND is_playoff = 0
         )
       ORDER BY r.lineup_slot = 'BN', r.points DESC`
    )
    .all(seasonId, teamId, seasonId) as TeamRosterRow[];
}

export function getTeamPointsByWeek(seasonId: number, teamId: number): TeamPointsWeekRow[] {
  return db
    .prepare(
      `SELECT w.week_num, sub.points FROM (
         SELECT m.week_id, m.home_score points FROM matchups m WHERE m.home_team_id = ?
         UNION ALL
         SELECT m.week_id, m.away_score FROM matchups m WHERE m.away_team_id = ?
       ) sub JOIN weeks w ON w.id = sub.week_id
       WHERE w.season_id = ? ORDER BY w.week_num`
    )
    .all(teamId, teamId, seasonId) as TeamPointsWeekRow[];
}

export function getTeamRecord(seasonId: number, teamId: number) {
  return db
    .prepare(
      `SELECT ps.wins, ps.losses, ps.ties, ps.points_for, ps.points_against,
              ps.playoff_seed, ps.playoff_odds
       FROM playoff_snapshots ps
       WHERE ps.season_id = ? AND ps.team_id = ?
         AND ps.week_num = (
           SELECT MAX(week_num) FROM playoff_snapshots WHERE season_id = ? AND team_id = ?
         )`
    )
    .get(seasonId, teamId, seasonId, teamId) as
    | {
        wins: number;
        losses: number;
        ties: number;
        points_for: number;
        points_against: number;
        playoff_seed: number | null;
        playoff_odds: number | null;
      }
    | undefined;
}

export function getPlayoffStandings(seasonId: number, weekNum: number): PlayoffStandingRow[] {
  return db
    .prepare(
      `SELECT t.id, t.name, t.abbrev, t.color, ps.wins, ps.losses, ps.ties, ps.points_for,
              ps.playoff_seed, ps.playoff_odds
       FROM playoff_snapshots ps JOIN teams t ON t.id = ps.team_id
       WHERE ps.season_id = ? AND ps.week_num = ?
       ORDER BY ps.playoff_seed IS NULL, ps.playoff_seed`
    )
    .all(seasonId, weekNum) as PlayoffStandingRow[];
}

export function getPlayoffBracket(seasonId: number): BracketGameRow[] {
  return db
    .prepare(
      `SELECT m.id, m.home_score, m.away_score, m.winner_team_id, w.is_playoff,
              w.week_num, w.label,
              th.id hid, th.name hname, th.abbrev habb, th.color hcolor,
              ta.id aid, ta.name aname, ta.abbrev aabb, ta.color acolor
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       JOIN teams th ON th.id = m.home_team_id
       JOIN teams ta ON ta.id = m.away_team_id
       WHERE w.season_id = ? AND m.is_playoff = 1
       ORDER BY w.week_num`
    )
    .all(seasonId) as BracketGameRow[];
}

export function getTopPerformers(seasonId: number, weekNum: number): PlayerRow[] {
  return db
    .prepare(
      `SELECT r.player_name, r.position, r.nfl_team, r.points, t.name tname, t.color
       FROM rosters r JOIN teams t ON t.id = r.team_id JOIN weeks w ON w.id = r.week_id
       WHERE w.season_id = ? AND w.week_num = ? AND r.lineup_slot != 'BN'
       ORDER BY r.points DESC LIMIT 25`
    )
    .all(seasonId, weekNum) as PlayerRow[];
}

export function getPositionLeaders(seasonId: number, limit = 5): PositionLeaders[] {
  const rows = db
    .prepare(
      `SELECT r.espn_player_id, r.player_name, r.position,
              SUM(r.points) total_points, COUNT(*) games
       FROM rosters r JOIN weeks w ON w.id = r.week_id
       WHERE w.season_id = ? AND r.lineup_slot != 'BN'
       GROUP BY r.espn_player_id, r.player_name, r.position
       ORDER BY r.position, total_points DESC`
    )
    .all(seasonId) as SeasonLeaderRow[];

  const byPosition = new Map<string, SeasonLeaderRow[]>();
  for (const row of rows) {
    const list = byPosition.get(row.position) ?? [];
    if (list.length < limit) list.push(row);
    byPosition.set(row.position, list);
  }

  return POSITION_ORDER.filter((p) => byPosition.has(p)).map((position) => ({
    position,
    leaders: byPosition.get(position) ?? [],
  }));
}

export function getTransactions(seasonId: number): TransactionRow[] {
  return db
    .prepare(
      `SELECT tx.type, tx.player_name, tx.bid_amount, tx.occurred_at, t.name tname, t.color
       FROM transactions tx LEFT JOIN teams t ON t.id = tx.team_id
       WHERE tx.season_id = ? ORDER BY tx.occurred_at DESC`
    )
    .all(seasonId) as TransactionRow[];
}

export function getRecords(): RecordRow[] {
  return db
    .prepare("SELECT * FROM records ORDER BY category, rank")
    .all() as RecordRow[];
}

export function getPredictData(seasonId: number, weekNum: number): PredictMatchupRow[] {
  return db
    .prepare(
      `SELECT m.id, m.home_score, m.away_score, m.winner_team_id,
              th.id hid, th.name hname, th.abbrev habb, th.color hcolor,
              eh.rating h_elo,
              ta.id aid, ta.name aname, ta.abbrev aabb, ta.color acolor,
              ea.rating a_elo
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       JOIN teams th ON th.id = m.home_team_id
       JOIN teams ta ON ta.id = m.away_team_id
       LEFT JOIN elo_ratings eh ON eh.season_id = ? AND eh.team_id = m.home_team_id AND eh.week_num = ? - 1
       LEFT JOIN elo_ratings ea ON ea.season_id = ? AND ea.team_id = m.away_team_id AND ea.week_num = ? - 1
       WHERE w.season_id = ? AND w.week_num = ?`
    )
    .all(seasonId, weekNum, seasonId, weekNum, seasonId, weekNum) as PredictMatchupRow[];
}

export function getStreaks(seasonId: number) {
  const matchups = db
    .prepare(
      `SELECT w.week_num, m.home_team_id, m.away_team_id, m.winner_team_id
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       WHERE w.season_id = ? AND w.is_playoff = 0
       ORDER BY w.week_num`
    )
    .all(seasonId) as {
    week_num: number;
    home_team_id: number;
    away_team_id: number;
    winner_team_id: number | null;
  }[];

  const teams = db.prepare("SELECT id, name, color FROM teams WHERE season_id = ?").all(seasonId) as {
    id: number;
    name: string;
    color: string;
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
      streaks.push({
        team_id: team.id,
        name: teamMap.get(team.id)?.name ?? "",
        color: teamMap.get(team.id)?.color ?? "#888",
        streak: currentStreak,
        type: currentType,
      });
    }
  }

  return streaks.sort((a, b) => b.streak - a.streak);
}

export function getHeadToHead(seasonId: number) {
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

  const teams = db
    .prepare("SELECT id, name, abbrev, color FROM teams WHERE season_id = ? ORDER BY id")
    .all(seasonId) as { id: number; name: string; abbrev: string; color: string }[];

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
