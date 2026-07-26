import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";

// Server-only module: depends on next/headers cookies() and node:crypto.
// Never import from a client component.

export const UNLOCKED_COOKIE = "unlocked";
export const REVEAL_COOKIE = "reveal";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function getSecret(): string | null {
  const s = process.env.REVEAL_SECRET;
  return s && s.length > 0 ? s : null;
}

/**
 * Sign a cookie value as `<value>.<hmac>`. When no secret is configured the
 * value is returned unsigned; getRevealState() then stays locked because it
 * cannot verify an unsigned token.
 */
export function signValue(value: string): string {
  const secret = getSecret();
  if (!secret) return value;
  const sig = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${sig}`;
}

/** Verify a signed `<value>.<hmac>` token; return the original value, or null on any failure. */
export function verifyValue(token: string | undefined): string | null {
  const secret = getSecret();
  if (!secret || !token) return null;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const value = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac("sha256", secret).update(value).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

/** True only when the passcode has been unlocked AND the reveal toggle is on. */
export interface RevealStatus {
  unlocked: boolean;
  revealed: boolean;
}

export const getRevealStatus = cache(async (): Promise<RevealStatus> => {
  const store = await cookies();
  const unlocked = verifyValue(store.get(UNLOCKED_COOKIE)?.value) === "1";
  const revealed = unlocked && verifyValue(store.get(REVEAL_COOKIE)?.value) !== "0";
  return { unlocked, revealed };
});

export async function getRevealState(): Promise<boolean> {
  return (await getRevealStatus()).revealed;
}

/** Neutral pseudonyms rendered while identities are locked. */
export function aliasOwner(n: number): string {
  return `Owner ${n}`;
}

export function aliasTeam(n: number): string {
  return `Team ${n}`;
}
