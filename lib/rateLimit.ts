const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_TRACKED_IPS = 5000;

const requestLog = new Map<string, number[]>();

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSeconds: number };

function evictIfNeeded(now: number): void {
  if (requestLog.size <= MAX_TRACKED_IPS) return;

  // An IP that had activity once and never came back keeps a stale
  // entry forever otherwise — nothing else ever revisits it to notice
  // every timestamp inside has expired.
  for (const [ip, timestamps] of requestLog) {
    if (timestamps.every((timestamp) => now - timestamp >= WINDOW_MS)) {
      requestLog.delete(ip);
    }
  }

  while (requestLog.size > MAX_TRACKED_IPS) {
    const oldestKey = requestLog.keys().next().value;
    if (oldestKey === undefined) break;
    requestLog.delete(oldestKey);
  }
}

/**
 * Fixed-window-ish limiter (rolling, per IP): 10 analyses/hour is
 * enough for a real visitor trying a few sites, low enough to keep
 * someone from burning the PageSpeed quota by hammering the endpoint.
 * In-memory like the domain cache — resets on deploy/restart, fine for
 * abuse prevention rather than a hard guarantee. Capped at
 * MAX_TRACKED_IPS so a long-running process facing many distinct IPs
 * can't grow this without bound.
 */
export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  const recent = (requestLog.get(ip) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    requestLog.set(ip, recent);
    return { limited: true, retryAfterSeconds };
  }

  recent.push(now);
  requestLog.set(ip, recent);
  evictIfNeeded(now);
  return { limited: false };
}
