import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkHttps } from "./https";

// checkHttps goes through safeFetch, which resolves DNS to check for a
// blocked IP before every request — mocked here so the test doesn't
// depend on real DNS, same as fetch itself.
vi.mock("node:dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34" }]) }));

function fakeResponse(url: string): Response {
  return { status: 200, headers: new Headers(), url, ok: true } as Response;
}

describe("checkHttps", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes when the final URL is https", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse("https://example.com/"));

    const result = await checkHttps("example.com");

    expect(result.passed).toBe(true);
  });

  it("passes the response headers through, for parseSecurityHeaders to read", async () => {
    const response = fakeResponse("https://example.com/");
    (response.headers as Headers).set("strict-transport-security", "max-age=1");
    vi.mocked(fetch).mockResolvedValueOnce(response);

    const result = await checkHttps("example.com");

    expect(result.headers?.get("strict-transport-security")).toBe("max-age=1");
  });

  it("fails when the final URL is still http", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse("http://example.com/"));

    const result = await checkHttps("http://example.com");

    expect(result.passed).toBe(false);
  });

  it("flags redirectedFromHttp when a plain http request lands on https", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse("https://example.com/"));

    const result = await checkHttps("example.com"); // no scheme -> defaults to http://

    expect(result.redirectedFromHttp).toBe(true);
  });

  it("does not flag redirectedFromHttp when the request already started on https", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse("https://example.com/"));

    const result = await checkHttps("https://example.com");

    expect(result.redirectedFromHttp).toBe(false);
  });

  it("reports a certificate error as data instead of throwing", async () => {
    const error = new Error("fetch failed");
    (error as { cause?: unknown }).cause = { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" };
    vi.mocked(fetch).mockRejectedValueOnce(error);

    const result = await checkHttps("https://example.com");

    expect(result).toEqual({
      passed: false,
      finalUrl: "https://example.com",
      redirectedFromHttp: false,
      certificateError: true,
    });
  });

  it("still throws for connection failures that aren't about the certificate", async () => {
    const error = new Error("fetch failed");
    (error as { cause?: unknown }).cause = { code: "ECONNREFUSED" };
    vi.mocked(fetch).mockRejectedValueOnce(error);

    await expect(checkHttps("https://example.com")).rejects.toThrow("fetch failed");
  });
});
