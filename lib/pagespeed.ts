import { normalizeUrl } from "./url";
import { PageSpeedError } from "./pageSpeedError";
import { PAGESPEED_TIMEOUT_MS } from "./timeouts";

const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export { PageSpeedError };

// Only the fields read below, not the full Lighthouse schema.
type PageSpeedApiResponse = {
  lighthouseResult?: {
    categories?: Partial<Record<PageSpeedCategory, { score?: number }>>;
    audits?: {
      "largest-contentful-paint"?: { numericValue?: number };
      "cumulative-layout-shift"?: { numericValue?: number };
      "server-response-time"?: { numericValue?: number };
      // Audit scores are 0-1, or null when the audit doesn't apply to the page.
      "color-contrast"?: { score?: number | null };
      "heading-order"?: { score?: number | null };
      label?: { score?: number | null };
      // Fallback for sites that block our fetch but let Google's through.
      "document-title"?: { score?: number | null };
      "meta-description"?: { score?: number | null };
      viewport?: { score?: number | null };
      "image-alt"?: { score?: number | null };
    };
  };
};

// Once at boot, so a missing key shows in the deploy log without
// repeating on every request.
if (!process.env.PAGESPEED_API_KEY && !process.env.VITEST) {
  console.warn(
    `[website-scanner] PAGESPEED_API_KEY is not set: every analysis will report Performance (and Google's share of SEO, accessibility and security) as "not measured" until it is.`,
  );
}

type PageSpeedCategory = "performance" | "accessibility" | "best-practices" | "seo";

// Missing values stay undefined: a fallback 0 would read as a verdict.
export type PageSpeedResult = {
  scores: Partial<Record<PageSpeedCategory, number>>;
  lcpSeconds?: number;
  clsValue?: number;
  hasColorContrastIssues?: boolean;
  ttfbMs?: number;
  hasHeadingOrderIssues?: boolean;
  hasFormLabelIssues?: boolean;
  hasTitle?: boolean;
  hasDescription?: boolean;
  hasViewport?: boolean;
  imagesHaveAlt?: boolean;
};

// All four categories in one call: the quota cost is the same.
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
  const passes = (score: number | null | undefined) => (typeof score === "number" ? score === 1 : undefined);
  const fails = (score: number | null | undefined) => (typeof score === "number" ? score < 1 : undefined);

  // One decimal: the raw figure varies from run to run anyway.
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
