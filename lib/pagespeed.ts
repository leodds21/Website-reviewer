const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export type PageSpeedCategory = "performance" | "accessibility" | "best-practices" | "seo";

export type PageSpeedResult = {
  scores: Record<PageSpeedCategory, number>;
};

/**
 * Runs Lighthouse via the PageSpeed Insights API for the given URL and
 * returns the category scores (0-100). Requests all four categories in
 * one call, since the API charges the same quota either way.
 */
export async function runPageSpeed(url: string): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    throw new Error("PAGESPEED_API_KEY não configurada");
  }

  const requestedUrl = url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;

  const endpoint = new URL(PAGESPEED_ENDPOINT);
  endpoint.searchParams.set("url", requestedUrl);
  endpoint.searchParams.set("key", apiKey);
  for (const category of ["performance", "accessibility", "best-practices", "seo"] as const) {
    endpoint.searchParams.append("category", category);
  }

  const response = await fetch(endpoint, {
    method: "GET",
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PageSpeed API retornou ${response.status}: ${body}`);
  }

  const data = await response.json();
  const categories = data.lighthouseResult?.categories ?? {};

  const scoreOf = (category: string): number => {
    const raw = categories[category]?.score;
    return typeof raw === "number" ? Math.round(raw * 100) : 0;
  };

  return {
    scores: {
      performance: scoreOf("performance"),
      accessibility: scoreOf("accessibility"),
      "best-practices": scoreOf("best-practices"),
      seo: scoreOf("seo"),
    },
  };
}
