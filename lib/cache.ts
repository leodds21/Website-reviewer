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
 * In-memory cache, no persistence — resets on every deploy/restart,
 * which is fine for the MVP: it only exists to avoid burning PageSpeed
 * quota on repeated analyses of the same site. Capped at MAX_ENTRIES
 * so a long-running process (or a burst of unique domains) can't grow
 * this without bound.
 */
export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs: number = FULL_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  evictIfNeeded();
}
