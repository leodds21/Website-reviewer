import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkHttps } from "@/lib/checks/https";
import { checkMetaTags } from "@/lib/checks/meta-tags";
import { checkAltImages } from "@/lib/checks/alt-images";
import { checkSitemapRobots } from "@/lib/checks/sitemap-robots";
import { runPageSpeed } from "@/lib/pagespeed";
import * as cache from "@/lib/cache";
import { GET } from "./route";

// The route orchestrates these five — mocked so this file tests the
// orchestration (rate limit, URL validation, cache, SSE framing, error
// handling), not the checks themselves, which already have their own
// tests with mocked fetch/DNS.
vi.mock("@/lib/checks/https", () => ({ checkHttps: vi.fn() }));
vi.mock("@/lib/checks/meta-tags", () => ({ checkMetaTags: vi.fn() }));
vi.mock("@/lib/checks/alt-images", () => ({ checkAltImages: vi.fn() }));
vi.mock("@/lib/checks/sitemap-robots", () => ({ checkSitemapRobots: vi.fn() }));
vi.mock("@/lib/pagespeed", () => ({ runPageSpeed: vi.fn() }));

const HAPPY = {
  https: { passed: true, finalUrl: "https://example.com/", redirectedFromHttp: false },
  metaTags: { hasViewport: true, hasTitle: true, title: "Example", hasDescription: true, description: "d" },
  altImages: { sampledCount: 5, missingAltCount: 0, missingAltSrcs: [] },
  sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
  pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 90, seo: 90 } },
};

beforeEach(() => {
  vi.mocked(checkHttps).mockResolvedValue(HAPPY.https);
  vi.mocked(checkMetaTags).mockResolvedValue(HAPPY.metaTags);
  vi.mocked(checkAltImages).mockResolvedValue(HAPPY.altImages);
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
    expect((await response.json()).error).toMatch(/URL/);
  });

  it("returns 400 for a URL that resolves to a blocked host, before running any check", async () => {
    const response = await GET(requestFor("localhost", "route-test-blocked.ip"));

    expect(response.status).toBe(400);
    expect(checkHttps).not.toHaveBeenCalled();
  });

  it("streams one step event per check, then done with the aggregated report", async () => {
    const response = await GET(requestFor("route-test-happy.example", "route-test-happy.ip"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const events = await readSseEvents(response);
    const steps = events.filter((event) => event.event === "step");
    const done = events.find((event) => event.event === "done");

    expect(steps).toHaveLength(5);
    expect(done).toBeDefined();
    const report = done!.data as { domain: string; score: { overall: number } };
    expect(report.domain).toBe("route-test-happy.example");
    expect(report.score.overall).toBeGreaterThan(0);
  });

  it("still sends done with a partial report when only some checks fail", async () => {
    // A single failure doesn't take the whole report down — score.ts/
    // issues.ts already treat a missing check as "not evaluated," so
    // whatever did succeed is worth reporting (the camara.rio case this
    // is modeled on: a broken cert kills every check that fetches page
    // content, but https itself still comes back with a real finding).
    vi.mocked(runPageSpeed).mockRejectedValueOnce(new Error("PageSpeed API retornou 500: quota exceeded"));

    const response = await GET(requestFor("route-test-partial.example", "route-test-partial.ip"));
    const events = await readSseEvents(response);

    expect(events.some((event) => event.event === "error")).toBe(false);
    const done = events.find((event) => event.event === "done");
    expect(done).toBeDefined();
    const report = done!.data as { score: { performance: { score: number | null } } };
    expect(report.score.performance.score).toBeNull();
  });

  it("emits an error event only when every single check fails", async () => {
    vi.mocked(checkHttps).mockRejectedValueOnce(new Error("fetch failed"));
    vi.mocked(checkMetaTags).mockRejectedValueOnce(new Error("fetch failed"));
    vi.mocked(checkAltImages).mockRejectedValueOnce(new Error("fetch failed"));
    vi.mocked(checkSitemapRobots).mockRejectedValueOnce(new Error("fetch failed"));
    vi.mocked(runPageSpeed).mockRejectedValueOnce(new Error("fetch failed"));

    const response = await GET(requestFor("route-test-total-fail.example", "route-test-total-fail.ip"));
    const events = await readSseEvents(response);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("error");
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
