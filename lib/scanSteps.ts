// In the order the scan plan lists them.
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
