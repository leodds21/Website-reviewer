// Login walls, WAFs and rate limits (999 is LinkedIn's). They mean "refused",
// never "missing" or "broken".
const BOT_BLOCK_STATUSES = new Set([401, 403, 429, 503, 999]);

export function isBotBlockStatus(status: number): boolean {
  return BOT_BLOCK_STATUSES.has(status);
}

export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpStatusError";
  }
}

// No usable answer from any of a check's requests.
export class UnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnreachableError";
  }
}
