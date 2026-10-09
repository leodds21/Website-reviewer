import { normalizeUrl } from "./url";
import { PageSpeedError } from "./pageSpeedError";
import { PAGESPEED_TIMEOUT_MS } from "./timeouts";

const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export { PageSpeedError };

// Only the handful of fields this file actually reads out of Google's
// much larger Lighthouse response — not a full schema.
type PageSpeedApiResponse = {
  lighthouseResult?: {
    categories?: Partial<Record<PageSpeedCategory, { score?: number }>>;
    audits?: {
      "largest-contentful-paint"?: { numericValue?: number };
      "cumulative-layout-shift"?: { numericValue?: number };
      // Time to First Byte, in ms — how long the server itself took to
      // start responding, before the browser had any HTML to work with.
      "server-response-time"?: { numericValue?: number };
      // Lighthouse audit scores are 0-1 pass/fail here (not a
      // percentage like the category scores), or null when the audit
      // doesn't apply to this page at all (e.g. no text found, or no
      // <form> elements for "label").
      "color-contrast"?: { score?: number | null };
      "heading-order"?: { score?: number | null };
      label?: { score?: number | null };
      // The same basics our own HTML checks look for. Read so a site
      // whose firewall refuses *our* fetch but lets Google's
      // Lighthouse through still gets them checked.
      "document-title"?: { score?: number | null };
      "meta-description"?: { score?: number | null };
      viewport?: { score?: number | null };
      "image-alt"?: { score?: number | null };
    };
  };
};

// Runs once per process (module load), not once per request — the
// per-request failure below already happens on every single analysis
// if the key is missing, which would spam the log instead of flagging
// the misconfiguration. This is the one line meant to be seen once, at
// boot, by whoever is watching deploy logs. Skipped under Vitest so
// test runs (which don't set this env var) don't print it on every
// import.
if (!process.env.PAGESPEED_API_KEY && !process.env.VITEST) {
  console.warn(
    `[website-scanner] PAGESPEED_API_KEY is not set: every analysis will report Performance (and Google's share of SEO, accessibility and security) as "not measured" until it is.`,
  );
}

type PageSpeedCategory = "performance" | "accessibility" | "best-practices" | "seo";

export type PageSpeedResult = {
  // Partial, not a 0 fallback, when a category is missing from the
  // response (Lighthouse can abort auditing just one category and
  // still return the others) — a fake 0 reads as "failed completely,"
  // which is a fabricated verdict, not merely absent data.
  scores: Partial<Record<PageSpeedCategory, number>>;
  // Undefined, not a 0 fallback, when the audit is missing from the
  // response — a fake 0s would read as "loads instantly," which is
  // actively misleading rather than merely absent data.
  lcpSeconds?: number;
  // Cumulative Layout Shift — how much visible content jumps around
  // during load. Unitless; Google's own published thresholds (not
  // ours) are cited where this is turned into a finding, in
  // lib/issues.ts.
  clsValue?: number;
  // Undefined when the color-contrast audit wasn't applicable to this
  // page at all (score: null) — distinct from "no problem found"
  // (score: 1, false).
  hasColorContrastIssues?: boolean;
  // Time to First Byte, in whole milliseconds. Google's own published
  // thresholds (not ours) are cited where this becomes a finding, in
  // lib/issues.ts.
  ttfbMs?: number;
  // Undefined when the heading-order audit wasn't applicable (e.g. no
  // headings on the page at all).
  hasHeadingOrderIssues?: boolean;
  // Undefined when the page has no <form> elements for the "label"
  // audit to check in the first place.
  hasFormLabelIssues?: boolean;
  // Lighthouse's own pass/fail for the basics parseMetaTags and
  // parseAltImages check — the fallback when our fetch of the page was
  // refused. Undefined when the audit is missing or not applicable
  // (image-alt on a page with no images).
  hasTitle?: boolean;
  hasDescription?: boolean;
  hasViewport?: boolean;
  imagesHaveAlt?: boolean;
};

/**
 * Runs Lighthouse via the PageSpeed Insights API for the given URL and
 * returns the category scores (0-100). Requests all four categories in
 * one call, since the API charges the same quota either way.
 */
export async function runPageSpeed(url: string, signal?: AbortSignal): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    throw new Error("PAGESPEED_API_KEY is not set");
  }

  const requestedUrl = normalizeUrl(url);

  const endpoint = new URL(PAGESPEED_ENDPOINT);
  endpoint.searchParams.set("url", requestedUrl);
  endpoint.searchParams.set("key", apiKey);
  for (const category of ["performance", "accessibility", "best-practices", "seo"] as const) {
    endpoint.searchParams.append("category", category);
  }

  const timeout = AbortSignal.timeout(PAGESPEED_TIMEOUT_MS);
  const response = await fetch(endpoint, {
    method: "GET",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new PageSpeedError(`PageSpeed API returned ${response.status}: ${body}`, response.status);
  }

  const data = (await response.json()) as PageSpeedApiResponse;
  const categories = data.lighthouseResult?.categories ?? {};

  const scoreOf = (category: PageSpeedCategory): number | undefined => {
    const raw = categories[category]?.score;
    return typeof raw === "number" ? Math.round(raw * 100) : undefined;
  };

  const audits = data.lighthouseResult?.audits;
  // An audit's pass/fail, or undefined when it's missing or didn't
  // apply to this page (score: null), never a guess either way.
  const passes = (score: number | null | undefined) => (typeof score === "number" ? score === 1 : undefined);
  const fails = (score: number | null | undefined) => (typeof score === "number" ? score < 1 : undefined);

  // Rounded to one decimal — the raw millisecond figure varies run to
  // run, and a false extra digit of precision doesn't help anyone.
  const lcpMs = audits?.["largest-contentful-paint"]?.numericValue;
  const lcpSeconds = typeof lcpMs === "number" ? Math.round((lcpMs / 1000) * 10) / 10 : undefined;

  const rawCls = audits?.["cumulative-layout-shift"]?.numericValue;
  const clsValue = typeof rawCls === "number" ? Math.round(rawCls * 1000) / 1000 : undefined;

  const rawTtfb = audits?.["server-response-time"]?.numericValue;
  const ttfbMs = typeof rawTtfb === "number" ? Math.round(rawTtfb) : undefined;

  return {
    scores: {
      performance: scoreOf("performance"),
      accessibility: scoreOf("accessibility"),
      "best-practices": scoreOf("best-practices"),
      seo: scoreOf("seo"),
    },
    lcpSeconds,
    clsValue,
    hasColorContrastIssues: fails(audits?.["color-contrast"]?.score),
    ttfbMs,
    hasHeadingOrderIssues: fails(audits?.["heading-order"]?.score),
    hasFormLabelIssues: fails(audits?.label?.score),
    hasTitle: passes(audits?.["document-title"]?.score),
    hasDescription: passes(audits?.["meta-description"]?.score),
    hasViewport: passes(audits?.viewport?.score),
    imagesHaveAlt: passes(audits?.["image-alt"]?.score),
  };
}
