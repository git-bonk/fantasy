import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import { verifyValue } from "./reveal";

// Server-only module: owner session for the prediction game. The signed `owner`
// cookie carries the owner's stable id; identity obfuscation is orthogonal — the
// site still renders aliases to everyone (a signed-in owner only gets a "you" marker).

export const OWNER_COOKIE = "owner";

export interface CurrentOwner {
  ownerId: string;
  aliasNum: number | null;
}

export const getCurrentOwner = cache(async (): Promise<CurrentOwner | null> => {
  const store = await cookies();
  const ownerId = verifyValue(store.get(OWNER_COOKIE)?.value);
  if (!ownerId) return null;
  const row = db
    .prepare("SELECT alias_num FROM owners WHERE id = ?")
    .get(ownerId) as { alias_num: number | null } | undefined;
  if (!row) return null;
  return { ownerId, aliasNum: row.alias_num };
});
