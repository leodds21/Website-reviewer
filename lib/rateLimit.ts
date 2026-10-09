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
 * their own; the key's expiry means an IP that stops showing up
 * doesn't need separate eviction logic the way the in-memory Map does.
 *
 * One MULTI, so one round trip and no gap between counting and adding:
 * as separate calls, two simultaneous requests could both read 9 and
 * both get through. The request is added before counting; one that
 * turns out to be over the limit is taken back out, so refusals don't
 * keep extending the wait.
 */
async function checkRateLimitRedis(ip: string, now: number): Promise<RateLimitResult> {
  const key = `ratelimit:${ip}`;
  // Unique per request, not just per IP: two requests in the same
  // millisecond would otherwise collide into one entry, undercounting.
  const member = `${now}-${Math.random()}`;

  const [, , count, oldest] = await redis!
    .multi()
    .zremrangebyscore(key, 0, now - WINDOW_MS)
    .zadd(key, { score: now, member })
    .zcard(key)
    .zrange<(string | number)[]>(key, 0, 0, { withScores: true })
    .pexpire(key, WINDOW_MS)
    .exec();

  if (count <= MAX_REQUESTS_PER_WINDOW) return { limited: false };

  // Best effort: the decision is already made. If taking the request back
  // out fails, it only counts against this IP a little longer, whereas
  // letting the error through would fall back to the in-memory limit and
  // could let an over-limit request in.
  await redis!.zrem(key, member).catch((error) => console.error("rateLimit: Redis cleanup failed", error));
  const oldestTimestamp = oldest.length >= 2 ? Number(oldest[1]) : now;
  return { limited: true, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - oldestTimestamp)) / 1000) };
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
  if (redis) {
    try {
      return await checkRateLimitRedis(ip, now);
    } catch (error) {
      // Fail open to the per-instance limit rather than 500 every
      // request: an unreachable Redis shouldn't take the site down.
      console.error("rateLimit: Redis failed, falling back to memory", error);
    }
  }
  return checkRateLimitInMemory(ip, now);
}
