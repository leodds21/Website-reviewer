import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkHttps } from "@/lib/checks/https";
import { checkSitemapRobots } from "@/lib/checks/sitemapRobots";
import { PageSpeedError, runPageSpeed } from "@/lib/pagespeed";
import { fetchHtml } from "@/lib/fetchHtml";
import * as cache from "@/lib/cache";
import { HttpStatusError } from "@/lib/httpStatus";
import type { AnalyzeReport } from "@/lib/report";
import { GET } from "./route";

// The checks have their own tests; this file covers the orchestration.
vi.mock("@/lib/checks/https", () => ({ checkHttps: vi.fn() }));
vi.mock("@/lib/checks/sitemapRobots", () => ({ checkSitemapRobots: vi.fn() }));
// The real PageSpeedError, so the route's instanceof check runs.
vi.mock("@/lib/pagespeed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pagespeed")>()),
  runPageSpeed: vi.fn(),
}));
vi.mock("@/lib/fetchHtml", () => ({ fetchHtml: vi.fn() }));

const HAPPY_HTML = `<html><head>
  <meta name="viewport" content="width=device-width">
  <title>Example</title>
  <meta name="description" content="d">
</head><body><img src="a.png" alt="ok"></body></html>`;

const HAPPY = {
  https: {
    passed: true,
    finalUrl: "https://example.com/",
    redirectedFromHttp: false,
    headers: new Headers({ "strict-transport-security": "max-age=1", "content-security-policy": "default-src 'self'" }),
  },
  sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
  pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 90, seo: 90 } },
};

beforeEach(() => {
  vi.mocked(checkHttps).mockResolvedValue(HAPPY.https);
  vi.mocked(fetchHtml).mockResolvedValue(HAPPY_HTML);
  vi.mocked(checkSitemapRobots).mockResolvedValue(HAPPY.sitemapRobots);
  vi.mocked(runPageSpeed).mockResolvedValue(HAPPY.pagespeed);
});

function requestFor(url: string, ip: string): Request {
  return new Request(`http://localhost/api/analyze?url=${encodeURIComponent(url)}`, {
    headers: { "x-forwarded-for": ip },
  });
}

async function readSseEvents(response: Response): Promise<{ event: string; data: unknown }[]> {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter((block) => block.trim())
    .map((block) => {
      const event = block.match(/^event: (.+)$/m)?.[1] ?? "";
      const data = JSON.parse(block.match(/^data: (.+)$/m)?.[1] ?? "null");
      return { event, data };
    });
}

describe("GET /api/analyze", () => {
  it("returns 400 when the url param is missing", async () => {
    const response = await GET(requestFor("", "route-test-missing.ip"));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("missing-url");
  });

  it("returns a machine-readable code, not a prose message, for a rejected URL", async () => {
    // The client owns the wording.
    const response = await GET(requestFor("not a url at all", "route-test-badurl.ip"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("invalid-url");
    expect(body.error).toBeUndefined();
  });

  it("returns blocked-url, distinct from invalid-url, for a URL that resolves to a blocked host, before running any check", async () => {
    const response = await GET(requestFor("localhost", "route-test-blocked.ip"));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("blocked-url");
    expect(checkHttps).not.toHaveBeenCalled();
  });

  it("passes checkHttps the raw input, not the https-forced target", async () => {
    // checkHttps starts at http:// to see whether the site upgrades.
    await GET(requestFor("route-test-scheme.example", "route-test-scheme.ip"));

    expect(checkHttps).toHaveBeenCalledWith("route-test-scheme.example", expect.anything());
  });

  it("streams one step event per check (6, including the derived metaTags/altImages and https/securityHeaders pairs), then done", async () => {
    const response = await GET(requestFor("route-test-happy.example", "route-test-happy.ip"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const events = await readSseEvents(response);
    const steps = events.filter((event) => event.event === "step");
    const done = events.find((event) => event.event === "done");

    expect(steps.map((s) => (s.data as { step: string }).step).sort()).toEqual(
      ["altImages", "brokenLinks", "https", "metaTags", "pagespeed", "securityHeaders", "sitemapRobots"].sort(),
    );
    expect(done).toBeDefined();
    const report = done!.data as { domain: string; score: { overall: number } };
    expect(report.domain).toBe("route-test-happy.example");
    expect(report.score.overall).toBeGreaterThan(0);
  });

  it("still completes a failed check's loading steps, so the loading screen never waits on it", async () => {
    vi.mocked(fetchHtml).mockRejectedValueOnce(new HttpStatusError(403, "The page answered 403."));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(requestFor("route-test-failed-steps.example", "route-test-failed-steps.ip"));
    const steps = (await readSseEvents(response))
      .filter((event) => event.event === "step")
      .map((event) => (event.data as { step: string }).step);

    // The page fetch failed, yet its two derived steps (and brokenLinks,
    // which waits on it) still arrive.
    expect(steps).toEqual(expect.arrayContaining(["metaTags", "altImages", "brokenLinks"]));
    errorSpy.mockRestore();
  });

  it("derives security-header findings from the https check's own response, no separate fetch", async () => {
    const response = await GET(requestFor("route-test-secheaders.example", "route-test-secheaders.ip"));
    const events = await readSseEvents(response);

    const done = events.find((event) => event.event === "done")!;
    const report = done.data as { issues: { code: string }[] };

    // HAPPY.https has HSTS and CSP but no clickjacking protection header.
    expect(report.issues.some((issue) => issue.code === "no-clickjacking-protection")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "no-hsts")).toBe(false);
    expect(report.issues.some((issue) => issue.code === "no-csp")).toBe(false);
  });

  it("lists what the site got right alongside the findings", async () => {
    const response = await GET(requestFor("route-test-passes.example", "route-test-passes.ip"));
    const events = await readSseEvents(response);

    const done = events.find((event) => event.event === "done")!;
    const passed = (done.data as { passed: { code: string }[] }).passed.map((pass) => pass.code);

    expect(passed).toEqual(expect.arrayContaining(["https", "title", "description", "viewport", "alt-images", "sitemap"]));
    // Missing the clickjacking header, so not all three protections.
    expect(passed).not.toContain("security-headers");
  });

  it("reports platform: null when the page matches no known site-builder", async () => {
    const response = await GET(requestFor("route-test-noplatform.example", "route-test-noplatform.ip"));
    const events = await readSseEvents(response);

    const done = events.find((event) => event.event === "done")!;
    expect((done.data as { platform: unknown }).platform).toBeNull();
  });

  it("derives the platform from the same page fetch metaTags/altImages already use, no extra request", async () => {
    vi.mocked(fetchHtml).mockClear();
    vi.mocked(fetchHtml).mockResolvedValueOnce('<html><head><meta name="generator" content="WordPress 6.4"></head></html>');

    const response = await GET(requestFor("route-test-wordpress.example", "route-test-wordpress.ip"));
    const events = await readSseEvents(response);

    expect(fetchHtml).toHaveBeenCalledTimes(1);
    const done = events.find((event) => event.event === "done")!;
    expect((done.data as { platform: unknown }).platform).toBe("wordpress");
  });

  it("still sends done with a partial report when only some checks fail", async () => {
    // A broken cert kills the page fetch, but https still has a finding.
    vi.mocked(runPageSpeed).mockRejectedValueOnce(new Error("PageSpeed API returned 500: quota exceeded"));

    const response = await GET(requestFor("route-test-partial.example", "route-test-partial.ip"));
    const events = await readSseEvents(response);

    expect(events.some((event) => event.event === "failed")).toBe(false);
    const done = events.find((event) => event.event === "done");
    expect(done).toBeDefined();
    const report = done!.data as { score: { performance: { score: number | null } } };
    expect(report.score.performance.score).toBeNull();
  });

  it("emits a failed event, carrying only a code, when every check fails", async () => {
    vi.mocked(checkHttps).mockRejectedValueOnce(new Error("fetch failed: internal detail nobody outside should see"));
    vi.mocked(fetchHtml).mockRejectedValueOnce(new Error("fetch failed"));
    vi.mocked(checkSitemapRobots).mockRejectedValueOnce(new Error("fetch failed"));
    vi.mocked(runPageSpeed).mockRejectedValueOnce(new Error("PAGESPEED_API_KEY is not set"));

    const response = await GET(requestFor("route-test-total-fail.example", "route-test-total-fail.ip"));
    const events = (await readSseEvents(response)).filter((event) => event.event !== "step");

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("failed");
    expect((events[0].data as { code: string }).code).toBe("analysis-failed");
    // Internal error detail stays in the server log.
    const serialized = JSON.stringify(events[0].data);
    expect(serialized).not.toContain("internal detail");
    expect(serialized).not.toContain("PAGESPEED_API_KEY");
  });

  it("emits quota-exceeded, not the generic analysis-failed, when every check fails and PageSpeed's own failure was a 429", async () => {
    vi.mocked(checkHttps).mockRejectedValueOnce(new Error("fetch failed"));
    vi.mocked(fetchHtml).mockRejectedValueOnce(new Error("fetch failed"));
    vi.mocked(checkSitemapRobots).mockRejectedValueOnce(new Error("fetch failed"));
    vi.mocked(runPageSpeed).mockRejectedValueOnce(new PageSpeedError("PageSpeed API returned 429: quota exceeded", 429));

    const response = await GET(requestFor("route-test-quota.example", "route-test-quota.ip"));
    const events = (await readSseEvents(response)).filter((event) => event.event !== "step");

    expect(events).toHaveLength(1);
    expect((events[0].data as { code: string }).code).toBe("quota-exceeded");
  });

  it("still emits analysis-failed when PageSpeed fails with a non-quota status, even if every check fails", async () => {
    vi.mocked(checkHttps).mockRejectedValueOnce(new Error("fetch failed"));
    vi.mocked(fetchHtml).mockRejectedValueOnce(new Error("fetch failed"));
    vi.mocked(checkSitemapRobots).mockRejectedValueOnce(new Error("fetch failed"));
    vi.mocked(runPageSpeed).mockRejectedValueOnce(new PageSpeedError("PageSpeed API returned 400: bad url", 400));

    const response = await GET(requestFor("route-test-non-quota.example", "route-test-non-quota.ip"));
    const events = (await readSseEvents(response)).filter((event) => event.event !== "step");

    expect((events[0].data as { code: string }).code).toBe("analysis-failed");
  });

  it("returns 429 with a rate-limited code and the wait time in the body", async () => {
    const ip = "route-test-rl-code.ip";
    for (let index = 0; index < 10; index++) {
      await GET(requestFor(`route-test-rlc-${index}.example`, ip));
    }

    const response = await GET(requestFor("route-test-rlc-last.example", ip));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("rate-limited");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("doesn't cache a partial report when the visitor left mid-analysis", async () => {
    // An abandoned run must not be cached for the next visitor.
    const setCachedSpy = vi.spyOn(cache, "setCached");
    const controller = new AbortController();
    vi.mocked(runPageSpeed).mockImplementationOnce(
      () => new Promise((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("aborted")))),
    );

    const request = new Request("http://localhost/api/analyze?url=route-test-abort.example", {
      headers: { "x-forwarded-for": "route-test-abort.ip" },
      signal: controller.signal,
    });

    const response = await GET(request);
    controller.abort();
    await readSseEvents(response).catch(() => []);

    expect(setCachedSpy).not.toHaveBeenCalled();
    setCachedSpy.mockRestore();
  });

  it("serves the second request for the same domain from cache, skipping the checks entirely", async () => {
    const domain = "route-test-cache.example";
    const first = await GET(requestFor(domain, "route-test-cache.ip"));
    // Draining the body makes sure setCached has run.
    await readSseEvents(first);
    vi.mocked(checkHttps).mockClear();

    const response = await GET(requestFor(domain, "route-test-cache.ip"));
    const events = await readSseEvents(response);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("done");
    expect(checkHttps).not.toHaveBeenCalled();
  });

  it("analyzes an HTTP-only site over http:// instead of stopping at the security score", async () => {
    vi.mocked(fetchHtml).mockClear();
    vi.mocked(checkHttps).mockResolvedValueOnce({ passed: false, finalUrl: "http://route-test-httponly.example/", redirectedFromHttp: false });
    // Nothing answers on https://, the plain-http version works.
    vi.mocked(fetchHtml).mockImplementation(async (url: string) => {
      if (url.startsWith("https://")) throw new TypeError("fetch failed");
      return HAPPY_HTML;
    });
    vi.mocked(checkSitemapRobots).mockImplementation(async (url: string) => {
      if (url.startsWith("https://")) throw new TypeError("fetch failed");
      return HAPPY.sitemapRobots;
    });
    vi.mocked(runPageSpeed).mockImplementation(async (url: string) => {
      if (url.startsWith("https://")) throw new PageSpeedError("Lighthouse returned error: FAILED_DOCUMENT_REQUEST", 400);
      return HAPPY.pagespeed;
    });

    const events = await readSseEvents(await GET(requestFor("route-test-httponly.example", "route-test-httponly.ip")));
    const report = events.find((event) => event.event === "done")!.data as AnalyzeReport;

    expect(vi.mocked(fetchHtml).mock.calls.map(([url]) => url)).toEqual(["https://route-test-httponly.example/", "http://route-test-httponly.example/"]);
    expect(report.score.seo.score).not.toBeNull();
    expect(report.score.performance.score).toBe(90);
    // The missing HTTPS is still the critical finding, security still 0.
    expect(report.score.security.score).toBe(0);
    expect(report.issues.some((issue) => issue.code === "no-https")).toBe(true);
  });

  it("doesn't retry over http:// when the site does serve HTTPS", async () => {
    vi.mocked(fetchHtml).mockClear();
    vi.mocked(fetchHtml).mockRejectedValueOnce(new HttpStatusError(403, "The page answered 403."));

    await readSseEvents(await GET(requestFor("route-test-https-fails.example", "route-test-https-fails.ip")));

    expect(fetchHtml).toHaveBeenCalledTimes(1);
  });

  it("doesn't count a cached report against the rate limit (reopening a report link)", async () => {
    const domain = "route-test-cache-rl.example";
    await readSseEvents(await GET(requestFor(domain, "route-test-cache-rl.ip")));

    for (let index = 0; index < 12; index++) {
      const response = await GET(requestFor(domain, "route-test-cache-rl.ip"));
      expect(response.status).toBe(200);
      expect((await readSseEvents(response))[0].event).toBe("done");
    }
  });

  it("answers a report link from the cache, and never starts an analysis for one past it", async () => {
    const domain = "route-test-cached-only.example";
    const cachedOnly = (url: string) =>
      new Request(`http://localhost/api/analyze?url=${encodeURIComponent(url)}&cached=only`, { headers: { "x-forwarded-for": "route-test-cached-only.ip" } });
    vi.mocked(checkHttps).mockClear();

    const miss = await GET(cachedOnly(domain));
    expect(miss.status).toBe(404);
    expect(await miss.json()).toEqual({ code: "not-cached" });
    expect(checkHttps).not.toHaveBeenCalled();

    await readSseEvents(await GET(requestFor(domain, "route-test-cached-only.ip")));
    const hit = await GET(cachedOnly(domain));
    expect((await readSseEvents(hit))[0].event).toBe("done");
  });

  it("keeps two paths on the same host from colliding in the cache", async () => {
    const host = "route-test-path.example";
    const first = await GET(requestFor(`${host}/a`, "route-test-path.ip"));
    await readSseEvents(first);
    vi.mocked(checkHttps).mockClear();

    const response = await GET(requestFor(`${host}/b`, "route-test-path.ip"));
    await readSseEvents(response);

    expect(checkHttps).toHaveBeenCalled();
  });

  it("explains a site that refuses automated access, without inventing findings (cruzeirodosulvirtual-style)", async () => {
    vi.mocked(fetchHtml).mockRejectedValueOnce(new HttpStatusError(403, "The page answered 403."));
    vi.mocked(checkSitemapRobots).mockRejectedValueOnce(new HttpStatusError(403, "Origin refused the check"));
    vi.mocked(runPageSpeed).mockRejectedValueOnce(
      new PageSpeedError("Lighthouse returned error: ERRORED_DOCUMENT_REQUEST. (Status code: 403)", 500),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(requestFor("route-test-blocked.example", "route-test-blocked.ip"));
    const events = await readSseEvents(response);
    const report = events.find((e) => e.event === "done")!.data as AnalyzeReport;

    expect(report.blocked).toBe(true);
    expect(report.score.performance).toEqual({ score: null, severity: "indisponivel", reason: "blocked" });
    expect(report.score.seo).toEqual({ score: null, severity: "indisponivel", reason: "blocked" });
    expect(report.score.accessibility).toEqual({ score: null, severity: "indisponivel", reason: "blocked" });
    expect(report.score.security).toMatchObject({ severity: "ok", partial: true });
    expect(report.issues.map((issue) => issue.code)).not.toContain("no-sitemap");

    errorSpy.mockRestore();
  });

  it("emits site-blocked when every check failed because the site refused us", async () => {
    vi.mocked(checkHttps).mockRejectedValueOnce(new HttpStatusError(403, "x"));
    vi.mocked(fetchHtml).mockRejectedValueOnce(new HttpStatusError(403, "x"));
    vi.mocked(checkSitemapRobots).mockRejectedValueOnce(new HttpStatusError(403, "x"));
    vi.mocked(runPageSpeed).mockRejectedValueOnce(new PageSpeedError("(Status code: 403)", 500));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(requestFor("route-test-all-blocked.example", "route-test-all-blocked.ip"));
    const events = (await readSseEvents(response)).filter((event) => event.event !== "step");

    expect(events).toEqual([{ event: "failed", data: { code: "site-blocked" } }]);
    errorSpy.mockRestore();
  });

  it("ends the stream with a failed event, not a dropped connection, when something unexpected throws", async () => {
    const setCachedSpy = vi.spyOn(cache, "setCached").mockRejectedValueOnce(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(requestFor("route-test-unexpected.example", "route-test-unexpected.ip"));
    const events = await readSseEvents(response);

    expect(events.at(-1)).toEqual({ event: "failed", data: { code: "analysis-failed" } });

    setCachedSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("caches a complete report with the full TTL and a partial one with the short TTL", async () => {
    const setCachedSpy = vi.spyOn(cache, "setCached");

    const complete = await GET(requestFor("route-test-ttl-complete.example", "route-test-ttl.ip"));
    await readSseEvents(complete);
    expect(setCachedSpy).toHaveBeenLastCalledWith(expect.any(String), expect.anything(), cache.FULL_TTL_MS);

    vi.mocked(runPageSpeed).mockRejectedValueOnce(new Error("timeout"));
    const partial = await GET(requestFor("route-test-ttl-partial.example", "route-test-ttl.ip"));
    await readSseEvents(partial);
    expect(setCachedSpy).toHaveBeenLastCalledWith(expect.any(String), expect.anything(), cache.PARTIAL_TTL_MS);

    setCachedSpy.mockRestore();
  });

  it("returns 429 with Retry-After once an IP exceeds 10 requests in the window", async () => {
    const ip = "route-test-ratelimit.ip";
    for (let i = 0; i < 10; i++) {
      await GET(requestFor(`route-test-rl-${i}.example`, ip)); // distinct domains avoid cache hits
    }

    const eleventh = await GET(requestFor("route-test-rl-11.example", ip));

    expect(eleventh.status).toBe(429);
    expect(eleventh.headers.get("Retry-After")).toBeTruthy();
  });
});
