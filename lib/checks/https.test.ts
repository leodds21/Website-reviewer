import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkHttps } from "./https";

// checkHttps goes through safeFetch, which resolves DNS to check for a
// blocked IP before every request — mocked here so the test doesn't
// depend on real DNS, same as fetch itself.
vi.mock("node:dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34" }]) }));

function fakeResponse(url: string, status = 200): Response {
  return { status, headers: new Headers(), url, ok: status >= 200 && status < 300 } as Response;
}

describe("checkHttps", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks https:// directly when a firewall refuses the plain-http request, instead of calling it 'no HTTPS'", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse("http://example.com/", 403))
      .mockResolvedValueOnce(fakeResponse("https://example.com/", 403));

    const result = await checkHttps("example.com");

    expect(result.passed).toBe(true);
    expect(vi.mocked(fetch).mock.calls[1][0].toString()).toBe("https://example.com/");
  });

  it("gives no verdict when http is refused and https can't be reached at all", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse("http://example.com/", 403))
      .mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(checkHttps("example.com")).rejects.toMatchObject({ name: "HttpStatusError", status: 403 });
  });

  it("still fails a plain-http site whose https:// can't be reached", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse("http://example.com/", 200))
      .mockRejectedValueOnce(new TypeError("fetch failed"));

    const result = await checkHttps("example.com");

    expect(result.passed).toBe(false);
    expect(result.noHttpRedirect).toBeUndefined();
  });

  it("passes, flagged as not redirecting, when http:// answers on its own but https:// works too", async () => {
    const secure = fakeResponse("https://example.com/");
    (secure.headers as Headers).set("strict-transport-security", "max-age=1");
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse("http://example.com/", 200))
      .mockResolvedValueOnce(secure);

    const result = await checkHttps("example.com");

    expect(result).toMatchObject({ passed: true, noHttpRedirect: true, finalUrl: "https://example.com/" });
    // The secure version's headers, for the hardening checks.
    expect(result.headers?.get("strict-transport-security")).toBe("max-age=1");
  });

  it("still fails when https:// just bounces back to http://", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse("http://example.com/", 200))
      .mockResolvedValueOnce(fakeResponse("http://example.com/", 200));

    const result = await checkHttps("example.com");

    expect(result.passed).toBe(false);
  });

  it("reports a broken certificate on the https:// side of a plain-http site", async () => {
    const error = new Error("fetch failed");
    (error as { cause?: unknown }).cause = { code: "CERT_HAS_EXPIRED" };
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse("http://example.com/", 200))
      .mockRejectedValueOnce(error);

    const result = await checkHttps("example.com");

    expect(result).toMatchObject({ passed: false, certificateError: true });
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
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse("http://example.com/"))
      .mockRejectedValueOnce(new TypeError("fetch failed"));

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
