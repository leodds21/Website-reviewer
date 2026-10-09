import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkSitemapRobots } from "./sitemapRobots";

// safeFetch resolves DNS before each request; mocked here.
vi.mock("node:dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34" }]) }));

// A real stream, since readTextCapped reads the body incrementally.
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
    // Many hosts answer 200 with an HTML "not found" page.
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

  it("reports an unreachable probe as null, not as a confirmed absence", async () => {
    // A failed request isn't "the file is missing".
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce(fakeResponse(200));

    const result = await checkSitemapRobots("example.com");

    expect(result.hasSitemap).toBeNull();
    expect(result.hasRobotsTxt).toBe(true);
  });

  it("throws when neither probe could reach the host at all", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

    await expect(checkSitemapRobots("este-dominio-nao-existe.example")).rejects.toMatchObject({ name: "UnreachableError" });
  });

  it("reports a firewall refusal (403) as unknown, not as a missing file", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(403)).mockResolvedValueOnce(fakeResponse(200));

    const result = await checkSitemapRobots("example.com");

    expect(result.hasSitemap).toBeNull();
    expect(result.hasRobotsTxt).toBe(true);
  });

  it("throws an HttpStatusError carrying the status when both probes are refused", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(403));

    await expect(checkSitemapRobots("example.com")).rejects.toMatchObject({ name: "HttpStatusError", status: 403 });
  });

  it("still reports a real 404 as a confirmed absence", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(404)).mockResolvedValueOnce(fakeResponse(404));

    const result = await checkSitemapRobots("example.com");

    expect(result.hasSitemap).toBe(false);
    expect(result.hasRobotsTxt).toBe(false);
  });
});
