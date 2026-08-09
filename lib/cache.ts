import { redis } from "./kv";

export const FULL_TTL_MS = 6 * 60 * 60 * 1000;
// A report where some checks failed to run shouldn't be trusted for as
// long as a complete one — a transient failure (a slow site timing
// out) shouldn't lock every visitor into a degraded report for 6
// hours. Short enough that a real, persistent problem (e.g. a genuinely
// broken certificate) still gets re-verified soon, long enough to
// still absorb a burst of repeat requests.
export const PARTIAL_TTL_MS = 5 * 60 * 1000;

const MAX_ENTRIES = 1000;

type CacheEntry<T> = { data: T; expiresAt: number };

// Only used by the in-memory fallback path — Redis expires keys on
// its own (see setCached), so there's nothing to sweep there.
const store = new Map<string, CacheEntry<unknown>>();

function evictIfNeeded(): void {
  if (store.size <= MAX_ENTRIES) return;

  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }

  // Still over the cap after clearing expired entries — the traffic is
  // real, not stale junk. Map preserves insertion order, so the first
  // keys are the oldest; drop enough of them to get back under the cap
  // rather than growing unbounded.
  while (store.size > MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

/**
 * Backed by Upstash Redis when configured (lib/kv.ts), an in-memory
 * Map otherwise. Exists only to avoid burning PageSpeed quota on
 * repeated analyses of the same site. The in-memory path resets on
 * every deploy/restart and isn't shared across concurrent serverless
 * instances — fine for local dev, not a real cache under real traffic.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (redis) {
    return (await redis.get<T>(key)) ?? null;
  }

  const entry = store.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.data as T;
}

export async function setCached<T>(key: string, data: T, ttlMs: number = FULL_TTL_MS): Promise<void> {
  if (redis) {
    // px: Redis's own expiry, in milliseconds — no manual eviction
    // needed, the key just stops existing on its own.
    await redis.set(key, data, { px: ttlMs });
    return;
  }

  // Delete before set so a refreshed key moves to the end of the Map's
  // insertion order. Without it, re-analyzing a popular domain keeps
  // its original position, and eviction — which walks from the oldest
  // key — would drop the entry getting the most traffic first.
  store.delete(key);
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  evictIfNeeded();
}
