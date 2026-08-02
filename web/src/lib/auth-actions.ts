"use server";

import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { db } from "./db";
import { OWNER_COOKIE } from "./auth";
import { signValue } from "./reveal";
import { clientIp, getLockError, recordFailure, recordSuccess } from "./rate-limit";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export interface OwnerLoginResult {
  ok: boolean;
  error?: string;
  aliasNum?: number | null;
}

function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export async function loginAsOwner(token: string): Promise<OwnerLoginResult> {
  const ip = await clientIp();
  const lockError = getLockError(ip);
  if (lockError) return { ok: false, error: lockError };

  const row = db
    .prepare("SELECT owner_id FROM owner_tokens WHERE token_hash = ? AND revoked_at IS NULL")
    .get(hashToken(token.trim())) as { owner_id: string } | undefined;

  if (!row) {
    recordFailure(ip);
    return { ok: false, error: "Invalid token." };
  }

  recordSuccess(ip);
  const alias = db
    .prepare("SELECT alias_num FROM owners WHERE id = ?")
    .get(row.owner_id) as { alias_num: number | null } | undefined;

  const store = await cookies();
  store.set(OWNER_COOKIE, signValue(row.owner_id), COOKIE_OPTIONS);
  return { ok: true, aliasNum: alias?.alias_num ?? null };
}

export async function logoutOwner(): Promise<void> {
  const store = await cookies();
  store.delete(OWNER_COOKIE);
}
