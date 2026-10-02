// Our own checks (https, page fetch, sitemap/robots) hit the target
// site directly, so 8s is a deliberately short leash — a slow or
// bot-blocking site shouldn't stall the whole report.
export const CHECK_TIMEOUT_MS = 8000;

// PageSpeed runs a full Lighthouse pass server-side on Google's end,
// which routinely takes well past 8s on its own — this is Google's
// turnaround time, not ours to shorten. 50s rather than 30s: a mobile
// Lighthouse run on a slow site (exactly the sites this tool exists
// for) often lands between 30 and 50s, and cutting it off there left
// Performance unmeasured on the reports that needed it most.
export const PAGESPEED_TIMEOUT_MS = 50000;

// checkBrokenLinks fires these concurrently (see MAX_LINKS_SAMPLED in
// lib/checks/brokenLinks.ts), so the whole check's added latency is
// bounded by this one timeout, not this times the sample size — kept
// shorter than CHECK_TIMEOUT_MS since it's a cheap status-only request
// against a link the site itself put on the page, not the full page
// load the other checks wait on.
export const LINK_CHECK_TIMEOUT_MS = 3000;
