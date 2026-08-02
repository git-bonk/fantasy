import { db } from "../db";
import type { Season, SeasonSettings, Week } from "../types";

export function getSeasons(): Season[] {
  return db.prepare("SELECT * FROM seasons ORDER BY year DESC").all() as Season[];
}

export function getSeasonSettings(seasonId: number): SeasonSettings {
  const row = db
    .prepare("SELECT settings_json FROM seasons WHERE id = ?")
    .get(seasonId) as { settings_json: string } | undefined;
  if (!row) return {};
  try {
    return JSON.parse(row.settings_json) as SeasonSettings;
  } catch {
    return {};
  }
}

export function getPlayoffFormat(seasonId: number) {
  return getSeasonSettings(seasonId).playoff ?? null;
}

export function getLatestSeasonId(): number {
  const row = db.prepare("SELECT id FROM seasons ORDER BY year DESC LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (!row) throw new Error("No seasons found in database");
  return row.id;
}

export function getSeasonByYear(year: number): Season | undefined {
  return db
    .prepare("SELECT * FROM seasons WHERE year = ?")
    .get(year) as Season | undefined;
}

export function getSeasonIdByYear(year: number): number {
  const row = db
    .prepare("SELECT id FROM seasons WHERE year = ?")
    .get(year) as { id: number } | undefined;
  if (!row) return getLatestSeasonId();
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
