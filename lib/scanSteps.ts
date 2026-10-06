/**
 * The step events the analyze route streams, one per finished check,
 * in the order the scan plan lists them. Shared by the route that sends
 * them and the screen that shows them, so neither can drift.
 */
export const SCAN_STEPS = [
  "https",
  "securityHeaders",
  "metaTags",
  "altImages",
  "sitemapRobots",
  "brokenLinks",
  "pagespeed",
] as const;

export type StepKey = (typeof SCAN_STEPS)[number];
