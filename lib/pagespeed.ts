import { normalizeUrl } from "./url";
import { PAGESPEED_TIMEOUT_MS } from "./timeouts";

const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

// Only the handful of fields this file actually reads out of Google's
// much larger Lighthouse response — not a full schema.
type PageSpeedApiResponse = {
  lighthouseResult?: {
    categories?: Partial<Record<PageSpeedCategory, { score?: number }>>;
    audits?: { "largest-contentful-paint"?: { numericValue?: number } };
  };
};

export type PageSpeedCategory = "performance" | "accessibility" | "best-practices" | "seo";

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
};

/**
 * Runs Lighthouse via the PageSpeed Insights API for the given URL and
 * returns the category scores (0-100). Requests all four categories in
 * one call, since the API charges the same quota either way.
 */
export async function runPageSpeed(url: string, signal?: AbortSignal): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    throw new Error("PAGESPEED_API_KEY não configurada");
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
    throw new Error(`PageSpeed API retornou ${response.status}: ${body}`);
  }

  const data = (await response.json()) as PageSpeedApiResponse;
  const categories = data.lighthouseResult?.categories ?? {};

  const scoreOf = (category: PageSpeedCategory): number | undefined => {
    const raw = categories[category]?.score;
    return typeof raw === "number" ? Math.round(raw * 100) : undefined;
  };

  // Rounded to one decimal — the raw millisecond figure varies run to
  // run, and a false extra digit of precision doesn't help anyone.
  const lcpMs = data.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue;
  const lcpSeconds = typeof lcpMs === "number" ? Math.round((lcpMs / 1000) * 10) / 10 : undefined;

  return {
    scores: {
      performance: scoreOf("performance"),
      accessibility: scoreOf("accessibility"),
      "best-practices": scoreOf("best-practices"),
      seo: scoreOf("seo"),
    },
    lcpSeconds,
  };
}
