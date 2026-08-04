const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

const requestLog = new Map<string, number[]>();

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSeconds: number };

/**
 * Fixed-window-ish limiter (rolling, per IP): 10 analyses/hour is
 * enough for a real visitor trying a few sites, low enough to keep
 * someone from burning the PageSpeed quota by hammering the endpoint.
 * In-memory like the domain cache — resets on deploy/restart, fine for
 * abuse prevention rather than a hard guarantee.
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
  return { limited: false };
}
