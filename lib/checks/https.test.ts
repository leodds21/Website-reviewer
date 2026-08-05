import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkHttps } from "./https";

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
