// Statuses a live server returns to an automated client it doesn't want
// (login walls, bot protection/WAF challenges, rate limits; 999 is
// LinkedIn's own). They say nothing about whether the page or file
// exists for a real visitor, so every check treats them as "we were
// refused", never as "it's missing" or "it's broken".
const BOT_BLOCK_STATUSES = new Set([401, 403, 429, 503, 999]);

export function isBotBlockStatus(status: number): boolean {
  return BOT_BLOCK_STATUSES.has(status);
}

/**
 * Carries the HTTP status of a target-site response a check couldn't
 * use, so the route can tell "the site refused us" apart from a
 * network failure or a timeout when it explains a missing category.
 */
export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpStatusError";
  }
}
