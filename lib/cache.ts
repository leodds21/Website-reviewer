import { redis } from "./kv";

export const FULL_TTL_MS = 6 * 60 * 60 * 1000;
// Short, so a transient failure doesn't stick for hours.
export const PARTIAL_TTL_MS = 5 * 60 * 1000;

const MAX_ENTRIES = 1000;

type CacheEntry<T> = { data: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();

function evictIfNeeded(): void {
  if (store.size <= MAX_ENTRIES) return;

  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }

  // Map keeps insertion order, so the first keys are the oldest.
  while (store.size > MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

// Saves PageSpeed quota on repeat analyses. Without Redis it's per instance.
export async function getCached<T>(key: string): Promise<T | null> {
  if (redis) {
    try {
      return (await redis.get<T>(key)) ?? null;
    } catch (error) {
      // The cache is an optimization; a Redis failure shouldn't fail the analysis.
      console.error("cache: Redis read failed, falling back to memory", error);
    }
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
    try {
      await redis.set(key, data, { px: ttlMs });
      return;
    } catch (error) {
      console.error("cache: Redis write failed, falling back to memory", error);
    }
  }

  // Moves a refreshed key to the end, so eviction doesn't drop a popular one first.
  store.delete(key);
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  evictIfNeeded();
}
