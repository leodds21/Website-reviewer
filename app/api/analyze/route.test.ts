import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkHttps } from "@/lib/checks/https";
import { checkSitemapRobots } from "@/lib/checks/sitemap-robots";
import { runPageSpeed } from "@/lib/pagespeed";
import { fetchHtml } from "@/lib/fetchHtml";
import * as cache from "@/lib/cache";
import { GET } from "./route";

// The route orchestrates these — mocked so this file tests the
// orchestration (rate limit, URL validation, cache, SSE framing, error
// handling), not the checks themselves, which already have their own
// tests. metaTags/altImages aren't mocked at all: they're pure parsers
// now, exercised for real against the HTML fetchHtml resolves with.
vi.mock("@/lib/checks/https", () => ({ checkHttps: vi.fn() }));
vi.mock("@/lib/checks/sitemap-robots", () => ({ checkSitemapRobots: vi.fn() }));
vi.mock("@/lib/pagespeed", () => ({ runPageSpeed: vi.fn() }));
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
    // The route has no idea which language the visitor picked, so
    // anything it phrases itself would be stuck in one language. The
    // client owns the wording.
    const response = await GET(requestFor("not a url at all", "route-test-badurl.ip"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("invalid-url");
    expect(body.error).toBeUndefined();
  });

  it("returns 400 for a URL that resolves to a blocked host, before running any check", async () => {
    const response = await GET(requestFor("localhost", "route-test-blocked.ip"));

    expect(response.status).toBe(400);
    expect(checkHttps).not.toHaveBeenCalled();
  });

  it("passes checkHttps the raw input, not the https-forced target", async () => {
    // checkHttps deliberately defaults to http:// to test whether the
    // site upgrades the connection — feeding it a URL already forced
    // to https (as the other checks correctly receive) made that
    // finding nearly unreachable, since it'd never observe a plain-
    // http request in the first place.
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
      ["altImages", "https", "metaTags", "pagespeed", "securityHeaders", "sitemapRobots"].sort(),
    );
    expect(done).toBeDefined();
    const report = done!.data as { domain: string; score: { overall: number } };
    expect(report.domain).toBe("route-test-happy.example");
    expect(report.score.overall).toBeGreaterThan(0);
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

  it("still sends done with a partial report when only some checks fail", async () => {
    // A single failure doesn't take the whole report down — score.ts/
    // issues.ts already treat a missing check as "not evaluated," so
    // whatever did succeed is worth reporting (the camara.rio case this
    // is modeled on: a broken cert kills the page fetch, but https
    // itself still comes back with a real finding).
    vi.mocked(runPageSpeed).mockRejectedValueOnce(new Error("PageSpeed API retornou 500: quota exceeded"));

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
    vi.mocked(runPageSpeed).mockRejectedValueOnce(new Error("PAGESPEED_API_KEY não configurada"));

    const response = await GET(requestFor("route-test-total-fail.example", "route-test-total-fail.ip"));
    const events = await readSseEvents(response);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("failed");
    expect((events[0].data as { code: string }).code).toBe("analysis-failed");
    // Internal error detail (API keys, raw response bodies, resolved
    // internal hostnames) never reaches the client, only server logs —
    // a bare code can't leak any of it by construction.
    const serialized = JSON.stringify(events[0].data);
    expect(serialized).not.toContain("internal detail");
    expect(serialized).not.toContain("PAGESPEED_API_KEY");
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
    // The UI turns this into "tenta de novo em X minutos" — without it
    // the message can only say "later", which is a worse answer.
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("doesn't cache a partial report when the visitor left mid-analysis", async () => {
    // Otherwise the half-finished results of an abandoned run get
    // served to the *next* visitor for the full partial TTL.
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
    // setCached() runs inside the stream's producer, after the response
    // object is already returned — draining the body is what guarantees
    // it has actually run before the second request checks the cache.
    await readSseEvents(first);
    vi.mocked(checkHttps).mockClear();

    const response = await GET(requestFor(domain, "route-test-cache.ip"));
    const events = await readSseEvents(response);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("done");
    expect(checkHttps).not.toHaveBeenCalled();
  });

  it("keeps two paths on the same host from colliding in the cache", async () => {
    const host = "route-test-path.example";
    const first = await GET(requestFor(`${host}/a`, "route-test-path.ip"));
    await readSseEvents(first);
    vi.mocked(checkHttps).mockClear();

    const response = await GET(requestFor(`${host}/b`, "route-test-path.ip"));
    await readSseEvents(response);

    // A different path on the same host must re-run the checks, not
    // silently serve /a's cached report for /b.
    expect(checkHttps).toHaveBeenCalled();
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
