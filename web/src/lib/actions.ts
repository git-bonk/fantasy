"use server";

import { cookies } from "next/headers";
import { REVEAL_COOKIE, UNLOCKED_COOKIE, signValue } from "./reveal";
import { clientIp, getLockError, recordFailure, recordSuccess, safeEqual } from "./rate-limit";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export interface UnlockResult {
  ok: boolean;
  error?: string;
}

export async function unlock(passcode: string): Promise<UnlockResult> {
  const expected = process.env.REVEAL_PASSCODE;
  const ip = await clientIp();

  const lockError = getLockError(ip);
  if (lockError) return { ok: false, error: lockError };

  const ok = expected ? safeEqual(passcode, expected) : false;
  if (ok) {
    recordSuccess(ip);
    const store = await cookies();
    store.set(UNLOCKED_COOKIE, signValue("1"), COOKIE_OPTIONS);
    store.set(REVEAL_COOKIE, signValue("1"), COOKIE_OPTIONS);
    return { ok: true };
  }

  recordFailure(ip);
  return { ok: false, error: "Incorrect passcode." };
}

export async function setReveal(on: boolean): Promise<void> {
  const store = await cookies();
  store.set(REVEAL_COOKIE, signValue(on ? "1" : "0"), COOKIE_OPTIONS);
}
