import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageSpeedError, runPageSpeed } from "./pagespeed";

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

  it("throws a PageSpeedError carrying the real status, so callers can tell quota exhaustion (429) from other failures", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeJsonResponse(429, { error: "quota exceeded" }));

    const failure = await runPageSpeed("example.com").catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(PageSpeedError);
    expect((failure as PageSpeedError).status).toBe(429);
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

  it("extracts CLS, rounded to three decimals", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, {
        lighthouseResult: {
          categories: { performance: { score: 0.5 } },
          audits: { "cumulative-layout-shift": { numericValue: 0.12345 } },
        },
      }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.clsValue).toBe(0.123);
  });

  it("leaves clsValue undefined when the audit is missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, { lighthouseResult: { categories: { performance: { score: 0.9 } } } }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.clsValue).toBeUndefined();
  });

  it("reports color-contrast issues when the audit score is below 1", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, {
        lighthouseResult: {
          categories: { accessibility: { score: 0.8 } },
          audits: { "color-contrast": { score: 0 } },
        },
      }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.hasColorContrastIssues).toBe(true);
  });

  it("reports no color-contrast issues when the audit passes", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, {
        lighthouseResult: {
          categories: { accessibility: { score: 1 } },
          audits: { "color-contrast": { score: 1 } },
        },
      }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.hasColorContrastIssues).toBe(false);
  });

  it("leaves hasColorContrastIssues undefined when the audit wasn't applicable (score: null)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, {
        lighthouseResult: {
          categories: { accessibility: { score: 1 } },
          audits: { "color-contrast": { score: null } },
        },
      }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.hasColorContrastIssues).toBeUndefined();
  });

  it("extracts TTFB in whole milliseconds from the server-response-time audit", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, {
        lighthouseResult: {
          categories: { performance: { score: 0.5 } },
          audits: { "server-response-time": { numericValue: 812.7 } },
        },
      }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.ttfbMs).toBe(813);
  });

  it("leaves ttfbMs undefined when the audit is missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, { lighthouseResult: { categories: { performance: { score: 0.9 } } } }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.ttfbMs).toBeUndefined();
  });

  it("reports heading-order issues when the audit score is below 1", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, {
        lighthouseResult: {
          categories: { accessibility: { score: 0.8 } },
          audits: { "heading-order": { score: 0 } },
        },
      }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.hasHeadingOrderIssues).toBe(true);
  });

  it("leaves hasHeadingOrderIssues undefined when the audit wasn't applicable (score: null)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, {
        lighthouseResult: {
          categories: { accessibility: { score: 1 } },
          audits: { "heading-order": { score: null } },
        },
      }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.hasHeadingOrderIssues).toBeUndefined();
  });

  it("reports form-label issues when the label audit score is below 1", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, {
        lighthouseResult: {
          categories: { accessibility: { score: 0.8 } },
          audits: { label: { score: 0 } },
        },
      }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.hasFormLabelIssues).toBe(true);
  });

  it("leaves hasFormLabelIssues undefined when the page has no forms (score: null)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeJsonResponse(200, {
        lighthouseResult: {
          categories: { accessibility: { score: 1 } },
          audits: { label: { score: null } },
        },
      }),
    );

    const result = await runPageSpeed("example.com");

    expect(result.hasFormLabelIssues).toBeUndefined();
  });
});
