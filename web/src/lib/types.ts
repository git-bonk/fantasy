export interface Season {
  id: number;
  year: number;
  league_id: string;
  settings_json: string;
  created_at: string;
}

export interface Owner {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  last_seen_season_id: number | null;
  alias_num: number | null;
}

export interface Team {
  id: number;
  season_id: number;
  espn_team_id: number;
  name: string;
  abbrev: string;
  owner_name: string;
  color: string;
  logo_url: string | null;
  owner_id: string | null;
}

export interface LeagueHistoryRow {
  owner_name: string;
  owner_id: string | null;
  team_name: string;
  abbrev: string;
  color: string;
  year: number;
}

export interface Week {
  id: number;
  season_id: number;
  week_num: number;
  label: string;
  start_date: string | null;
  end_date: string | null;
  is_playoff: number;
}

export interface Matchup {
  id: number;
  week_id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  winner_team_id: number | null;
  is_playoff: number;
}

export interface RosterRow {
  id: number;
  week_id: number;
  team_id: number;
  espn_player_id: number;
  player_name: string;
  position: string;
  nfl_team: string;
  lineup_slot: string;
  points: number;
}

export interface Transaction {
  id: number;
  season_id: number;
  team_id: number | null;
  espn_player_id: number | null;
  player_name: string | null;
  type: string;
  bid_amount: number | null;
  occurred_at: string;
}

export interface EloRating {
  id: number;
  season_id: number;
  team_id: number;
  week_num: number;
  rating: number;
}

export interface OwnerEloRating {
  id: number;
  owner_id: string;
  season_id: number;
  week_num: number;
  rating: number;
}

export interface OwnerStandingRow {
  owner_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  rating: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface OwnerEloHistoryRow {
  year: number;
  season_id: number;
  week_num: number;
  rating: number;
}

export interface Luck {
  id: number;
  season_id: number;
  team_id: number;
  week_num: number;
  actual_wins: number;
  expected_wins: number;
  luck_score: number;
}

export interface Award {
  id: number;
  week_id: number;
  type: string;
  team_id: number | null;
  player_name: string | null;
  value: number | null;
  detail: string | null;
}

export interface Sos {
  id: number;
  season_id: number;
  team_id: number;
  week_num: number;
  opp_avg_points: number;
  sos_rank: number | null;
}

export interface PlayoffSnapshot {
  id: number;
  season_id: number;
  week_num: number;
  team_id: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  playoff_seed: number | null;
  playoff_odds: number | null;
}

export interface RecordRow {
  id: number;
  category: string;
  rank: number;
  season_id: number | null;
  team_id: number | null;
  player_name: string | null;
  value: number | null;
  detail: string | null;
}

export interface RankingRow {
  id: number;
  name: string;
  abbrev: string;
  color: string;
  rating: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
}

export interface EloHistoryRow {
  week_num: number;
  id: number;
  name: string;
  color: string;
  rating: number;
}

export interface MatchupRow {
  id: number;
  home_score: number;
  away_score: number;
  winner_team_id: number | null;
  is_playoff: number;
  hid: number;
  hname: string;
  habb: string;
  hcolor: string;
  aid: number;
  aname: string;
  aabb: string;
  acolor: string;
}

export interface BracketGameRow extends MatchupRow {
  week_num: number;
  label: string;
}

export interface RecapAwardRow {
  type: string;
  value: number | null;
  detail: string | null;
  player_name: string | null;
  tname: string | null;
  color: string | null;
}

export interface LuckRow {
  id: number;
  name: string;
  color: string;
  actual_wins: number;
  expected_wins: number;
  luck_score: number;
}

export interface TrendRow {
  week_num: number;
  avg_pts: number;
}

export interface TeamTrendRow {
  week_num: number;
  team_id: number;
  name: string;
  color: string;
  points: number;
}

export interface TeamStandingRow {
  id: number;
  name: string;
  abbrev: string;
  owner_name: string;
  color: string;
  logo_url: string | null;
  wins: number | null;
  losses: number | null;
  points_for: number | null;
  points_against: number | null;
  playoff_seed: number | null;
  playoff_odds: number | null;
}

export interface PlayoffStandingRow {
  id: number;
  name: string;
  abbrev: string;
  color: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  playoff_seed: number | null;
  playoff_odds: number | null;
}

export interface PlayerRow {
  player_name: string;
  position: string;
  nfl_team: string;
  points: number;
  tname: string;
  color: string;
}

export interface SeasonLeaderRow {
  espn_player_id: number;
  player_name: string;
  position: string;
  total_points: number;
  games: number;
}

export interface PositionLeaders {
  position: string;
  leaders: SeasonLeaderRow[];
}

export interface TransactionRow {
  type: string;
  player_name: string | null;
  bid_amount: number | null;
  occurred_at: string;
  tname: string | null;
  color: string | null;
}

export interface TeamRosterRow {
  player_name: string;
  position: string;
  nfl_team: string;
  lineup_slot: string;
  points: number;
}

export interface WeekRosterRow extends TeamRosterRow {
  team_id: number;
}

export interface TeamPointsWeekRow {
  week_num: number;
  points: number;
}

export interface SosRow {
  opp_avg_points: number;
  sos_rank: number | null;
}

export interface PredictMatchupRow {
  id: number;
  home_score: number;
  away_score: number;
  winner_team_id: number | null;
  hid: number;
  hname: string;
  habb: string;
  hcolor: string;
  h_elo: number | null;
  aid: number;
  aname: string;
  aabb: string;
  acolor: string;
  a_elo: number | null;
}

export type MatchupTag =
  | "UPSET"
  | "NAIL_BITER"
  | "BLOWOUT"
  | "STATEMENT"
  | "REVENGE"
  | "BUST"
  | "SHOOTOUT";

export interface RecapMatchupRow extends MatchupRow {
  tag: MatchupTag | null;
}

export interface SeasonMatchupRow {
  week_num: number;
  home_team_id: number;
  away_team_id: number;
  winner_team_id: number | null;
}

export interface EloAtWeekRow {
  team_id: number;
  rating: number;
}

export interface ShameItem {
  kind: "BIGGEST_LOSS" | "LOWEST_SCORE" | "LONGEST_LOSING_STREAK" | "UNLUCKIEST" | "CHEAPEST_WIN";
  label: string;
  headline: string;
  value: number;
  suffix: string;
  teamId: number | null;
  teamName: string;
  abbrev: string;
  color: string;
  detail: string;
}

export interface RivalryGameRow {
  id: number;
  week_num: number;
  label: string;
  is_playoff: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  winner_team_id: number | null;
}

export interface TeamStreak {
  streak: number;
  type: "W" | "L";
}
