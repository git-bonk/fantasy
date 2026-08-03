export interface Season {
  id: number;
  year: number;
  league_id: string;
  settings_json: string;
  created_at: string;
}

export interface PlayoffFormat {
  team_count: number;
  regular_season_weeks: number | null;
  start_week: number | null;
  rounds: number;
  reseeding: boolean;
  seeding_rule: string | null;
  round_length_weeks: number;
  consolation_ladder: boolean;
  divisions: string[];
}

export interface SeasonSettings {
  scoring?: unknown;
  playoff_teams?: number;
  playoff?: PlayoffFormat;
}

export interface Owner {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
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
  owner_alias_num?: number | null;
  standing?: number | null;
  final_standing?: number | null;
}

export interface LeagueHistoryRow {
  owner_name: string;
  owner_id: string | null;
  team_name: string;
  abbrev: string;
  color: string;
  year: number;
  owner_alias_num?: number | null;
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
  occurred_at: string;
  week_num: number | null;
  source: string;
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
  owner_alias_num?: number | null;
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
  owner_alias_num?: number | null;
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
  owner_alias_num?: number | null;
}

export interface EloHistoryRow {
  week_num: number;
  id: number;
  name: string;
  color: string;
  rating: number;
  owner_alias_num?: number | null;
}

export interface MatchupRow {
  id: number;
  home_score: number;
  away_score: number;
  winner_team_id: number | null;
  is_playoff: number;
  playoff_tier?: string;
  hid: number;
  hname: string;
  habb: string;
  hcolor: string;
  aid: number;
  aname: string;
  aabb: string;
  acolor: string;
  h_owner_alias_num?: number | null;
  a_owner_alias_num?: number | null;
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
  owner_alias_num?: number | null;
}

export interface LuckRow {
  id: number;
  name: string;
  color: string;
  actual_wins: number;
  expected_wins: number;
  luck_score: number;
  owner_alias_num?: number | null;
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
  owner_alias_num?: number | null;
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
  owner_alias_num?: number | null;
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
  owner_alias_num?: number | null;
}

export interface FinalStandingRow {
  id: number;
  name: string;
  abbrev: string;
  color: string;
  final_standing: number | null;
  standing: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  points_for: number | null;
  owner_alias_num?: number | null;
}

export interface PlayerRow {
  player_id: number | null;
  player_name: string;
  position: string;
  nfl_team: string;
  points: number;
  tname: string;
  color: string;
  owner_alias_num?: number | null;
}

export interface TransactionRow {
  type: string;
  player_name: string | null;
  week_num: number;
  week_label: string;
  tname: string | null;
  color: string | null;
  owner_alias_num?: number | null;
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

export interface TeamPlayerHistoryRow {
  player_id: number | null;
  player_name: string;
  position: string;
  nfl_team: string;
  first_week: number;
  last_week: number;
  weeks_held: number;
  total_points: number;
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
  h_owner_alias_num?: number | null;
  a_owner_alias_num?: number | null;
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

export interface OwnerToken {
  id: number;
  owner_id: string;
  label: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface Prediction {
  owner_id: string;
  season_id: number;
  week_num: number;
  matchup_key: string;
  picked_team_id: number | null;
  locked_at: string | null;
}

export interface ScheduledMatchup {
  season_id: number;
  week_num: number;
  home_team_id: number;
  away_team_id: number;
  kickoff: string | null;
}

export interface PickableRow {
  matchup_key: string;
  kickoff: string | null;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: number | null;
  hid: number;
  hname: string;
  habb: string;
  hcolor: string;
  h_alias: number | null;
  aid: number;
  aname: string;
  aabb: string;
  acolor: string;
  a_alias: number | null;
  prob: number | null;
}

export interface PredictionLeaderboardRow {
  owner_id: string;
  alias_num: number | null;
  display_name: string;
  correct: number;
  total: number;
  points: number;
  streak: number;
}

export interface PickDistributionRow {
  team_id: number;
  abbrev: string;
  color: string;
  alias_num: number | null;
  count: number;
}
