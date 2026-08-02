import { headers } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

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

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.reset < now && bucket.lockedUntil < now) buckets.delete(key);
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function getLockError(key: string): string | null {
  const now = Date.now();
  prune(now);
  const bucket = buckets.get(key);
  if (bucket && bucket.lockedUntil > now) {
    const secs = Math.ceil((bucket.lockedUntil - now) / 1000);
    return `Too many attempts. Try again in ${secs}s.`;
  }
  return null;
}

export function recordFailure(key: string): void {
  const now = Date.now();
  prune(now);
  const bucket =
    buckets.get(key) ?? { count: 0, reset: now + WINDOW_MS, strikes: 0, lockedUntil: 0 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + WINDOW_MS;
  }
  bucket.count += 1;
  if (bucket.count >= MAX_ATTEMPTS) {
    bucket.strikes += 1;
    bucket.lockedUntil = now + BASE_LOCK_MS * 2 ** (bucket.strikes - 1);
    bucket.count = 0;
  }
  buckets.set(key, bucket);
}

export function recordSuccess(key: string): void {
  buckets.delete(key);
}
