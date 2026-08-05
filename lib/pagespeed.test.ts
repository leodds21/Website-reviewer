import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runPageSpeed } from "./pagespeed";

function fakeJsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("runPageSpeed", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("PAGESPEED_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("throws when PAGESPEED_API_KEY isn't configured", async () => {
    vi.stubEnv("PAGESPEED_API_KEY", "");

    await expect(runPageSpeed("example.com")).rejects.toThrow(/PAGESPEED_API_KEY/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps Lighthouse's 0-1 category scores to 0-100", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, {
        lighthouseResult: {
          categories: {
            performance: { score: 0.9 },
            accessibility: { score: 0.95 },
            "best-practices": { score: 1 },
            seo: { score: 0.8 },
          },
        },
      }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.scores).toEqual({ performance: 90, accessibility: 95, "best-practices": 100, seo: 80 });
  });

  it("leaves a missing category undefined instead of fabricating a 0", async () => {
    // A fabricated 0 would read as "failed completely" — a real
    // verdict we never actually measured. Lighthouse can abort just
    // one category's audit and still return the others, so this is a
    // real response shape, not a hypothetical.
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, { lighthouseResult: { categories: { performance: { score: 0.5 } } } }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.scores.performance).toBe(50);
    expect(result.scores.seo).toBeUndefined();
  });

  it("throws with the status and body when the API call fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeJsonResponse(403, { error: "quota exceeded" }));

    await expect(runPageSpeed("example.com")).rejects.toThrow(/403/);
  });

  it("extracts LCP in seconds from the largest-contentful-paint audit", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, {
        lighthouseResult: {
          categories: { performance: { score: 0.3 } },
          audits: { "largest-contentful-paint": { numericValue: 6234 } },
        },
      }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.lcpSeconds).toBe(6.2);
  });

  it("leaves lcpSeconds undefined when the audit is missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, { lighthouseResult: { categories: { performance: { score: 0.9 } } } }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.lcpSeconds).toBeUndefined();
  });
});
