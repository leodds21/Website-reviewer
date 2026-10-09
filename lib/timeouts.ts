// Short, so a slow or bot-blocking site can't stall the report.
export const CHECK_TIMEOUT_MS = 8000;

// A mobile Lighthouse run on a slow site often takes 30 to 50s.
export const PAGESPEED_TIMEOUT_MS = 50000;

// Links are checked concurrently, so this bounds the whole check.
export const LINK_CHECK_TIMEOUT_MS = 3000;
