import { describe, expect, it, vi } from "vitest";
import { runAnalysis } from "./runAnalysis";
import { runPageSpeed } from "./pagespeed";

vi.mock("./checks/https", () => ({ checkHttps: vi.fn(async () => ({ passed: true, finalUrl: "https://x.com/", redirectedFromHttp: false })) }));
vi.mock("./checks/sitemapRobots", () => ({ checkSitemapRobots: vi.fn(async () => ({ hasSitemap: true, hasRobotsTxt: true })) }));
vi.mock("./fetchHtml", () => ({ fetchHtml: vi.fn(async () => "<title>x</title>") }));
vi.mock("./pagespeed", () => ({ runPageSpeed: vi.fn() }));

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
});
