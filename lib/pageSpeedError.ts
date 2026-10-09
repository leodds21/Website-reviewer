// Separate from pagespeed.ts: checkFailure imports it and reaches the
// browser bundle, which shouldn't include the PageSpeed client.
export class PageSpeedError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PageSpeedError";
  }
}
