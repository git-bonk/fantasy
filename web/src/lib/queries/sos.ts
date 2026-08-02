export const SOS_FALLBACK_RATING = 1500;

export const SOS_TIER_SIZE = 3;

export interface SosTeamIdentity {
  id: number;
  name: string;
  abbrev: string;
  color: string;
  owner_alias_num: number | null;
}

export interface SosMatchupPair {
  home_team_id: number;
  away_team_id: number;
}

export interface RemainingSosRow extends SosTeamIdentity {
  games_left: number;
  opp_avg_rating: number;
  sos_rank: number;
}

export type SosTier = "hard" | "easy";

export function rankRemainingSos(
  teams: readonly SosTeamIdentity[],
  matchups: readonly SosMatchupPair[],
  latestRatings: ReadonlyMap<number, number>
): RemainingSosRow[] {
  const gamesLeft = new Map<number, number>();
  const ratingTotals = new Map<number, number>();
  for (const team of teams) {
    gamesLeft.set(team.id, 0);
    ratingTotals.set(team.id, 0);
  }

  for (const matchup of matchups) {
    if (matchup.home_team_id === matchup.away_team_id) continue;
    const homeStrength = latestRatings.get(matchup.home_team_id) ?? SOS_FALLBACK_RATING;
    const awayStrength = latestRatings.get(matchup.away_team_id) ?? SOS_FALLBACK_RATING;
    const homeGames = gamesLeft.get(matchup.home_team_id);
    const awayGames = gamesLeft.get(matchup.away_team_id);
    if (homeGames !== undefined) {
      gamesLeft.set(matchup.home_team_id, homeGames + 1);
      const homeTotal = ratingTotals.get(matchup.home_team_id) ?? 0;
      ratingTotals.set(matchup.home_team_id, homeTotal + awayStrength);
    }
    if (awayGames !== undefined) {
      gamesLeft.set(matchup.away_team_id, awayGames + 1);
      const awayTotal = ratingTotals.get(matchup.away_team_id) ?? 0;
      ratingTotals.set(matchup.away_team_id, awayTotal + homeStrength);
    }
  }

  const aggregated = teams.map((team) => {
    const games = gamesLeft.get(team.id) ?? 0;
    const total = ratingTotals.get(team.id) ?? 0;
    return {
      ...team,
      games_left: games,
      opp_avg_rating: games > 0 ? total / games : SOS_FALLBACK_RATING,
    };
  });

  return aggregated
    .map((row) => ({
      ...row,
      sos_rank: 1 + aggregated.filter((r) => r.opp_avg_rating > row.opp_avg_rating).length,
    }))
    .sort((a, b) => a.sos_rank - b.sos_rank || a.id - b.id);
}

export function isEvenSos(rows: readonly RemainingSosRow[]): boolean {
  if (rows.length === 0) return true;
  const first = rows[0].opp_avg_rating;
  return rows.every((row) => Math.abs(row.opp_avg_rating - first) < 1e-9);
}

export function sosTier(row: RemainingSosRow, rows: readonly RemainingSosRow[]): SosTier | null {
  if (isEvenSos(rows)) return null;
  if (row.sos_rank <= SOS_TIER_SIZE) return "hard";
  const easier = rows.filter((r) => r.opp_avg_rating < row.opp_avg_rating).length;
  if (easier < SOS_TIER_SIZE) return "easy";
  return null;
}
