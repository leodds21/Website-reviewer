const TTL_MS = 6 * 60 * 60 * 1000;

type CacheEntry<T> = { data: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();

/**
 * In-memory cache by domain, no persistence — resets on every deploy/
 * restart, which is fine for the MVP: it only exists to avoid burning
 * PageSpeed quota on repeated analyses of the same site.
 */
export function getCached<T>(domain: string): T | null {
  const entry = store.get(domain);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    store.delete(domain);
    return null;
  }

  return entry.data as T;
}

export function setCached<T>(domain: string, data: T): void {
  store.set(domain, { data, expiresAt: Date.now() + TTL_MS });
}
