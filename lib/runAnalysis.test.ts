import { describe, expect, it, vi } from "vitest";
import { runAnalysis } from "./runAnalysis";
import { runPageSpeed } from "./pagespeed";
import { fetchHtml } from "./fetchHtml";
import { checkBrokenLinks } from "./checks/brokenLinks";

vi.mock("./checks/https", () => ({ checkHttps: vi.fn(async () => ({ passed: true, finalUrl: "https://x.com/", redirectedFromHttp: false })) }));
vi.mock("./checks/sitemapRobots", () => ({ checkSitemapRobots: vi.fn(async () => ({ hasSitemap: true, hasRobotsTxt: true, blocksGooglebot: null, hasFaviconIco: null })) }));
vi.mock("./fetchHtml", () => ({ fetchHtml: vi.fn(async () => ({ html: "<title>x</title>", headers: new Headers(), finalUrl: "https://x.com/" })) }));
vi.mock("./pagespeed", () => ({ runPageSpeed: vi.fn() }));
vi.mock("./checks/brokenLinks", () => ({ checkBrokenLinks: vi.fn(async () => ({ checkedCount: 0, brokenCount: 0, brokenUrls: [] })) }));

describe("runAnalysis", () => {
  it("stops PageSpeed at the request's deadline, so a late run still ends in time", async () => {
    vi.mocked(runPageSpeed).mockImplementation(
      (_url, signal) => new Promise((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason))),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const started = Date.now();

    const outcome = await runAnalysis(
      { rawUrl: "x.com", target: "https://x.com/", domain: "x.com", signal: new AbortController().signal, deadline: Date.now() + 100 },
      { onStep: () => {}, onPartial: () => {} },
    );

    expect(Date.now() - started).toBeLessThan(2000);
    expect(outcome).toMatchObject({ kind: "report", complete: false });
  });

  it("checks links against the address the page redirected to", async () => {
    // spacejam.com/1996 redirects to /1996/, whose links are relative to it.
    vi.mocked(fetchHtml).mockResolvedValueOnce({ html: '<a href="cmp/jam.html">x</a>', headers: new Headers(), finalUrl: "https://x.com/1996/" });
    vi.mocked(runPageSpeed).mockResolvedValue({ scores: {} });

    await runAnalysis(
      { rawUrl: "x.com/1996", target: "https://x.com/1996", domain: "x.com", signal: new AbortController().signal, deadline: Date.now() + 5000 },
      { onStep: () => {}, onPartial: () => {} },
    );

    expect(checkBrokenLinks).toHaveBeenCalledWith('<a href="cmp/jam.html">x</a>', "https://x.com/1996/", expect.anything());
  });
});
