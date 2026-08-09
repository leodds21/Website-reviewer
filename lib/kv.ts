import { Redis } from "@upstash/redis";

/**
 * Configured only when both env vars are present — cache.ts and
 * rateLimit.ts fall back to an in-memory Map when this is null, the
 * same "works locally, degrades gracefully, needs real config for
 * real behavior in production" pattern already used for
 * PAGESPEED_API_KEY.
 *
 * Upstash specifically (a REST API, not a persistent TCP connection)
 * because a serverless function shouldn't hold a long-lived socket
 * open — a plain Redis client would either leak connections across
 * invocations or pay a new-connection cost on every one.
 *
 * The in-memory fallback isn't just a local-dev convenience: a Map at
 * module scope resets on every deploy/cold start and isn't shared
 * across concurrent serverless instances, so without these two env
 * vars set in production, the rate limit is "per instance," not the
 * real per-IP limit its own comments claim, and the analysis cache
 * mostly doesn't hit at all under real traffic.
 */
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;
