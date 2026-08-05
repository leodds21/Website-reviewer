import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkSitemapRobots } from "./sitemap-robots";

// checkSitemapRobots goes through safeFetch, which resolves DNS to
// check for a blocked IP before every request — mocked here so the
// test doesn't depend on real DNS, same as fetch itself.
vi.mock("node:dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34" }]) }));

// A real ReadableStream body, not a stub: sitemapExistsAt reads through
// readTextCapped (which streams rather than calling response.text(), so
// a hostile server can't feed us an unbounded body), and that only
// works against a genuine stream.
function fakeResponse(status: number, body = ""): Response {
  return {
    status,
    headers: new Headers(),
    ok: status >= 200 && status < 300,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        if (body) controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
  } as unknown as Response;
}

const REAL_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://example.com/</loc></url></urlset>`;

describe("checkSitemapRobots", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports both present when the sitemap is real XML and robots.txt is 200", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse(200, REAL_SITEMAP))
      .mockResolvedValueOnce(fakeResponse(200));

    const result = await checkSitemapRobots("example.com");

    expect(result.hasSitemap).toBe(true);
    expect(result.hasRobotsTxt).toBe(true);
  });

  it("reports missing when the request 404s", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(404)).mockResolvedValueOnce(fakeResponse(200));

    const result = await checkSitemapRobots("example.com");

    expect(result.hasSitemap).toBe(false);
    expect(result.hasRobotsTxt).toBe(true);
  });

  it("reports the sitemap missing on a soft-404 (200 OK with an HTML error page)", async () => {
    // Many hosts return 200 with a normal HTML "page not found" body
    // instead of a real 404 status for a missing sitemap.xml — a bare
    // status check would report "found" for a sitemap that doesn't
    // actually exist.
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse(200, "<html><body>404 - Page not found</body></html>"))
      .mockResolvedValueOnce(fakeResponse(200));

    const result = await checkSitemapRobots("example.com");

    expect(result.hasSitemap).toBe(false);
  });

  it("accepts a sitemap index (not just a plain urlset) as a real sitemap", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse(200, `<?xml version="1.0"?><sitemapindex></sitemapindex>`))
      .mockResolvedValueOnce(fakeResponse(200));

    const result = await checkSitemapRobots("example.com");

    expect(result.hasSitemap).toBe(true);
  });

  it("treats a network error as missing rather than throwing", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce(fakeResponse(200));

    const result = await checkSitemapRobots("example.com");

    expect(result.hasSitemap).toBe(false);
    expect(result.hasRobotsTxt).toBe(true);
  });
});
