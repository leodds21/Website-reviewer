import { redis } from "./kv";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_TRACKED_IPS = 5000;

const requestLog = new Map<string, number[]>();

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSeconds: number };

function evictIfNeeded(now: number): void {
  if (requestLog.size <= MAX_TRACKED_IPS) return;

  // Nothing else revisits an IP that never comes back.
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

// Rolling window in a sorted set. One MULTI, so two simultaneous requests
// can't both read 9 and get through. A refused request is removed again
// so refusals don't extend the wait.
async function checkRateLimitRedis(ip: string, now: number): Promise<RateLimitResult> {
  const key = `ratelimit:${ip}`;
  // Two requests in the same millisecond would otherwise collide.
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

  // Best effort: rethrowing would fall back to memory and could let this request in.
  await redis!.zrem(key, member).catch((error) => console.error("rateLimit: Redis cleanup failed", error));
  const oldestTimestamp = oldest.length >= 2 ? Number(oldest[1]) : now;
  return { limited: true, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - oldestTimestamp)) / 1000) };
}

// 10/hour is plenty for a real visitor and protects the PageSpeed quota.
// Without Redis the limit is per serverless instance, not per IP.
export async function checkRateLimit(ip: string, now: number = Date.now()): Promise<RateLimitResult> {
  if (redis) {
    try {
      return await checkRateLimitRedis(ip, now);
    } catch (error) {
      // A Redis outage shouldn't take the site down.
      console.error("rateLimit: Redis failed, falling back to memory", error);
    }
  }
  return checkRateLimitInMemory(ip, now);
}
