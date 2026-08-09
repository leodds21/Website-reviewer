import { redis } from "./kv";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_TRACKED_IPS = 5000;

// Only used by the in-memory fallback path.
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

function checkRateLimitInMemory(ip: string, now: number): RateLimitResult {
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

/**
 * A sorted set keyed by IP, member = a unique per-request token, score
 * = the request's timestamp — the same rolling window the in-memory
 * version tracks with a plain array, just stored where every
 * serverless instance can see it. ZREMRANGEBYSCORE prunes anything
 * outside the window before counting, so old requests age out on
 * their own; EXPIRE on the key means an IP that stops showing up
 * doesn't need separate eviction logic the way the in-memory Map does.
 */
async function checkRateLimitRedis(ip: string, now: number): Promise<RateLimitResult> {
  const key = `ratelimit:${ip}`;
  const windowStart = now - WINDOW_MS;

  await redis!.zremrangebyscore(key, 0, windowStart);
  const count = await redis!.zcard(key);

  if (count >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = await redis!.zrange<(string | number)[]>(key, 0, 0, { withScores: true });
    const oldestTimestamp = oldest.length >= 2 ? Number(oldest[1]) : now;
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - oldestTimestamp)) / 1000);
    return { limited: true, retryAfterSeconds };
  }

  // Member must be unique per request, not just per IP — two requests
  // in the same millisecond would otherwise collide and dedupe into
  // one entry in the set, undercounting real traffic.
  await redis!.zadd(key, { score: now, member: `${now}-${Math.random()}` });
  await redis!.expire(key, Math.ceil(WINDOW_MS / 1000));
  return { limited: false };
}

/**
 * Fixed-window-ish limiter (rolling, per IP): 10 analyses/hour is
 * enough for a real visitor trying a few sites, low enough to keep
 * someone from burning the PageSpeed quota by hammering the endpoint.
 * Backed by Upstash Redis when configured (lib/kv.ts), an in-memory
 * Map otherwise — the in-memory path resets on deploy/restart and
 * isn't shared across concurrent serverless instances, so it's a
 * per-instance limit there, not the real per-IP guarantee this
 * function's name implies. Configure Upstash for that guarantee to be
 * real in production.
 */
export async function checkRateLimit(ip: string, now: number = Date.now()): Promise<RateLimitResult> {
  if (redis) return checkRateLimitRedis(ip, now);
  return checkRateLimitInMemory(ip, now);
}
