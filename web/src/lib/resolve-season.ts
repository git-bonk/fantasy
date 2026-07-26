import { cookies } from "next/headers";
import { getSeasons, getSeasonIdByYear, getWeeks, getMaxWeek } from "./queries";
import type { Week } from "./types";

export interface ResolvedSeason {
  seasonId: number;
  year: number;
  weekNum: number;
  maxWeek: number;
  weeks: Week[];
}

/**
 * Resolve the active season + week from URL search params, falling back to
 * cookies, then to the latest season / max week.
 *
 * Call from any server component:
 *   const ctx = await resolveSeason(searchParams);
 */
export async function resolveSeason(
  searchParams: Promise<{ year?: string; week?: string }>
): Promise<ResolvedSeason> {
  const params = await searchParams;
  const cookieStore = await cookies();

  // --- Year / Season ---
  const seasons = getSeasons();
  let year: number;

  if (params.year && !isNaN(Number(params.year))) {
    year = Number(params.year);
  } else if (cookieStore.get("fantasy_year")?.value) {
    year = Number(cookieStore.get("fantasy_year")!.value);
  } else {
    year = seasons[0]?.year ?? new Date().getFullYear();
  }

  // Validate year exists in DB; fall back to latest
  const seasonId = getSeasonIdByYear(year);
  const resolvedYear = seasons.find((s) => s.id === seasonId)?.year ?? year;

  // --- Week ---
  const weeks = getWeeks(seasonId);
  const maxWeek = getMaxWeek(seasonId);
  let weekNum: number;

  if (params.week && !isNaN(Number(params.week))) {
    weekNum = Math.min(Math.max(Number(params.week), 1), maxWeek);
  } else if (cookieStore.get("fantasy_week")?.value) {
    const cookieWeek = Number(cookieStore.get("fantasy_week")!.value);
    weekNum = !isNaN(cookieWeek) ? Math.min(Math.max(cookieWeek, 1), maxWeek) : maxWeek;
  } else {
    weekNum = maxWeek;
  }

  return { seasonId, year: resolvedYear, weekNum, maxWeek, weeks };
}
