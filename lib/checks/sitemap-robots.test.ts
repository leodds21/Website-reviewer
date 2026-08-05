import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkSitemapRobots } from "./sitemap-robots";

function fakeResponse(url: string, status: number): Response {
  return { status, headers: new Headers(), url, ok: status >= 200 && status < 300 } as Response;
}

describe("checkSitemapRobots", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports both present when both return 200", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse("https://example.com/sitemap.xml", 200))
      .mockResolvedValueOnce(fakeResponse("https://example.com/robots.txt", 200));

    const result = await checkSitemapRobots("example.com");

    expect(result.hasSitemap).toBe(true);
    expect(result.hasRobotsTxt).toBe(true);
  });

  it("reports missing when the request 404s", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse("https://example.com/sitemap.xml", 404))
      .mockResolvedValueOnce(fakeResponse("https://example.com/robots.txt", 200));

    const result = await checkSitemapRobots("example.com");

    expect(result.hasSitemap).toBe(false);
    expect(result.hasRobotsTxt).toBe(true);
  });

  it("treats a network error as missing rather than throwing", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(fakeResponse("https://example.com/robots.txt", 200));

    const result = await checkSitemapRobots("example.com");

    expect(result.hasSitemap).toBe(false);
    expect(result.hasRobotsTxt).toBe(true);
  });
});
