/**
 * Carries the response status alongside the message, so a caller can
 * tell "Google's quota for this key ran out" (429) apart from "the URL
 * we sent was rejected" or "the key itself is bad" (4xx) without
 * re-parsing the message string.
 *
 * Its own module, not lib/pagespeed.ts: checkFailure.ts needs the class
 * for instanceof, and checkFailure reaches the browser through the
 * score (lib/score.ts → lib/issues.ts → the report). Importing it from
 * pagespeed.ts shipped the whole PageSpeed client, API endpoint and
 * missing-key warning included, to every visitor.
 */
export class PageSpeedError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PageSpeedError";
  }
}
