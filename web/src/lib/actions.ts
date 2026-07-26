"use server";

import { cookies, headers } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { REVEAL_COOKIE, UNLOCKED_COOKIE, signValue } from "./reveal";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const BASE_LOCK_MS = 15 * 1000;

interface Bucket {
  count: number;
  reset: number;
  strikes: number;
  lockedUntil: number;
}

const buckets = new Map<string, Bucket>();

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.reset < now && bucket.lockedUntil < now) buckets.delete(key);
  }
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export interface UnlockResult {
  ok: boolean;
  error?: string;
}

export async function unlock(passcode: string): Promise<UnlockResult> {
  const expected = process.env.REVEAL_PASSCODE;
  const ip = await clientIp();
  const now = Date.now();
  prune(now);

  const bucket =
    buckets.get(ip) ?? { count: 0, reset: now + WINDOW_MS, strikes: 0, lockedUntil: 0 };

  if (bucket.lockedUntil > now) {
    const secs = Math.ceil((bucket.lockedUntil - now) / 1000);
    return { ok: false, error: `Too many attempts. Try again in ${secs}s.` };
  }
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + WINDOW_MS;
  }

  const ok = expected ? safeEqual(passcode, expected) : false;
  if (ok) {
    buckets.delete(ip);
    const store = await cookies();
    store.set(UNLOCKED_COOKIE, signValue("1"), COOKIE_OPTIONS);
    store.set(REVEAL_COOKIE, signValue("1"), COOKIE_OPTIONS);
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count >= MAX_ATTEMPTS) {
    bucket.strikes += 1;
    bucket.lockedUntil = now + BASE_LOCK_MS * 2 ** (bucket.strikes - 1);
    bucket.count = 0;
  }
  buckets.set(ip, bucket);
  return { ok: false, error: "Incorrect passcode." };
}

export async function setReveal(on: boolean): Promise<void> {
  const store = await cookies();
  store.set(REVEAL_COOKIE, signValue(on ? "1" : "0"), COOKIE_OPTIONS);
}
