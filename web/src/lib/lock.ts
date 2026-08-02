import { db } from "./db";

// Mirrors pipeline/fantasynfl/lock.py::is_locked. A week is locked once it is
// finalized or the current time passes its first scheduled kickoff. Missing
// kickoff data fails CLOSED (locked) so picks can never be made after kickoff.
export function isWeekLocked(
  seasonId: number,
  weekNum: number,
  now: Date = new Date()
): boolean {
  const week = db
    .prepare("SELECT finalized FROM weeks WHERE season_id = ? AND week_num = ?")
    .get(seasonId, weekNum) as { finalized: number } | undefined;
  if (week?.finalized) return true;

  const row = db
    .prepare(
      "SELECT MIN(kickoff) AS kickoff FROM scheduled_matchups WHERE season_id = ? AND week_num = ?"
    )
    .get(seasonId, weekNum) as { kickoff: string | null } | undefined;
  if (!row?.kickoff) return true;

  return now.getTime() >= new Date(row.kickoff).getTime();
}
