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
});
