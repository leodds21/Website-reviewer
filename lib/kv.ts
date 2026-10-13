import { Redis } from "@upstash/redis";

// Upstash's REST API suits serverless: no long-lived socket. Without these
// vars, the cache, rate limit, analysis locks and shared reports live in memory.
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// Two quick retries, not the default five (about 4 s per call): during an
// outage a request makes several calls and must still end before maxDuration.
export const redis = url && token ? new Redis({ url, token, retry: { retries: 2, backoff: (attempt) => 100 * 2 ** attempt } }) : null;

/**
 * An Upstash error without the command it carries: those messages end with
 * the full request body (visitor IPs, analyzed URLs, reports), which mustn't
 * outlive their own TTL in the logs.
 */
export function redisError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return message.replace(/,?\s*command was:[\s\S]*$/, "");
}
