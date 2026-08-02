// Auto-generated from pipeline/fantasynfl/db/schema.py (SCHEMA). Do not edit by hand.
// Regenerate: python -m fantasynfl.typegen

export interface Seasons {
  id: number;
  year: number;
  league_id: string;
  settings_json: string;
  created_at: string;
  status: string;
}

export interface Owners {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  alias_num: number | null;
}

export interface Teams {
  id: number;
  season_id: number;
  espn_team_id: number;
  name: string;
  abbrev: string;
  owner_name: string;
  color: string;
  logo_url: string | null;
  owner_id: string | null;
  standing: number | null;
  final_standing: number | null;
}

export interface Weeks {
  id: number;
  season_id: number;
  week_num: number;
  label: string;
  start_date: string | null;
  end_date: string | null;
  is_playoff: number;
  finalized: number;
}

export interface Matchups {
  id: number;
  week_id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  winner_team_id: number | null;
  is_playoff: number;
  playoff_tier: string;
}

export interface Rosters {
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

export interface Transactions {
  id: number;
  season_id: number;
  team_id: number | null;
  espn_player_id: number | null;
  player_name: string | null;
  type: string;
  bid_amount: number | null;
  occurred_at: string;
  week_num: number | null;
  source: string;
}

export interface EloRatings {
  id: number;
  season_id: number;
  team_id: number;
  week_num: number;
  rating: number;
}

export interface OwnerElo {
  id: number;
  owner_id: string;
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

export interface Awards {
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

export interface PlayoffSnapshots {
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

export interface Records {
  id: number;
  category: string;
  rank: number;
  season_id: number | null;
  team_id: number | null;
  player_name: string | null;
  value: number | null;
  detail: string | null;
}

export interface OwnerTokens {
  id: number;
  owner_id: string;
  token_hash: string;
  label: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface Predictions {
  id: number;
  owner_id: string;
  season_id: number;
  week_num: number;
  matchup_key: string;
  picked_team_id: number | null;
  locked_at: string | null;
}

export interface ScheduledMatchups {
  id: number;
  season_id: number;
  week_num: number;
  home_team_id: number;
  away_team_id: number;
  kickoff: string | null;
}

export interface Players {
  id: number;
  espn_player_id: number;
  full_name: string;
  position: string;
  nfl_team: string;
  first_season_id: number | null;
  last_season_id: number | null;
}

export interface CoachRatings {
  id: number;
  season_id: number;
  team_id: number;
  week_num: number;
  actual_points: number;
  optimal_points: number;
  bench_points: number;
  efficiency: number;
}

export interface Trades {
  id: number;
  season_id: number;
  week_num: number;
  team_a_id: number;
  team_b_id: number;
  a_players_json: string;
  b_players_json: string;
  a_points: number | null;
  b_points: number | null;
  winner_side: string | null;
  weeks_evaluated: number;
  finalized: number;
}

export interface WaiverImpact {
  id: number;
  season_id: number;
  team_id: number;
  espn_player_id: number;
  player_name: string;
  move_type: string;
  week_num: number;
  points_after: number;
  label: string;
}

export interface PlayoffScenarios {
  id: number;
  season_id: number;
  week_num: number;
  team_id: number;
  p_wins_out: number | null;
  p_lose_out: number | null;
  min_wins_fifty: number | null;
  win_dist_json: string;
}
