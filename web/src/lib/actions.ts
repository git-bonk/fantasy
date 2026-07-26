"use server";

import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { REVEAL_COOKIE, UNLOCKED_COOKIE, signValue } from "./reveal";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export interface UnlockResult {
  ok: boolean;
  error?: string;
}

export async function unlock(passcode: string): Promise<UnlockResult> {
  const expected = process.env.REVEAL_PASSCODE;
  if (!expected) {
    return { ok: false, error: "Reveal is not configured on this server." };
  }
  if (!safeEqual(passcode, expected)) {
    return { ok: false, error: "Incorrect passcode." };
  }
  const store = await cookies();
  store.set(UNLOCKED_COOKIE, signValue("1"), COOKIE_OPTIONS);
  store.set(REVEAL_COOKIE, signValue("1"), COOKIE_OPTIONS);
  return { ok: true };
}

export async function setReveal(on: boolean): Promise<void> {
  const store = await cookies();
  store.set(REVEAL_COOKIE, signValue(on ? "1" : "0"), COOKIE_OPTIONS);
}
