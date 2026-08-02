"use server";

import { revalidatePath } from "next/cache";
import { dbWrite } from "./db-write";
import { getCurrentOwner } from "./auth";
import { isWeekLocked } from "./lock";

export interface PickResult {
  ok: boolean;
  error?: string;
}

export async function setPick(
  seasonId: number,
  weekNum: number,
  matchupKey: string,
  teamId: number
): Promise<PickResult> {
  const owner = await getCurrentOwner();
  if (!owner) return { ok: false, error: "Sign in to make picks." };
  if (isWeekLocked(seasonId, weekNum)) return { ok: false, error: "This week is locked." };

  dbWrite
    .prepare(
      `INSERT INTO predictions (owner_id, season_id, week_num, matchup_key, picked_team_id, locked_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(owner_id, season_id, week_num, matchup_key)
       DO UPDATE SET picked_team_id = excluded.picked_team_id, locked_at = excluded.locked_at`
    )
    .run(owner.ownerId, seasonId, weekNum, matchupKey, teamId, new Date().toISOString());

  revalidatePath("/predictions");
  return { ok: true };
}

export async function clearPick(
  seasonId: number,
  weekNum: number,
  matchupKey: string
): Promise<PickResult> {
  const owner = await getCurrentOwner();
  if (!owner) return { ok: false, error: "Sign in to make picks." };
  if (isWeekLocked(seasonId, weekNum)) return { ok: false, error: "This week is locked." };

  dbWrite
    .prepare(
      `INSERT INTO predictions (owner_id, season_id, week_num, matchup_key, picked_team_id, locked_at)
       VALUES (?, ?, ?, ?, NULL, ?)
       ON CONFLICT(owner_id, season_id, week_num, matchup_key)
       DO UPDATE SET picked_team_id = NULL, locked_at = excluded.locked_at`
    )
    .run(owner.ownerId, seasonId, weekNum, matchupKey, new Date().toISOString());

  revalidatePath("/predictions");
  return { ok: true };
}
