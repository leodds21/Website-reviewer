import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlockedHostError, isBlockedHost, safeFetch } from "./safeFetch";

function fakeResponse(status: number, opts: { location?: string; url?: string } = {}): Response {
  const headers = new Headers();
  if (opts.location) headers.set("location", opts.location);
  return { status, headers, url: opts.url ?? "", ok: status >= 200 && status < 300 } as Response;
}

describe("isBlockedHost", () => {
  it.each([
    "localhost",
    "127.0.0.1",
    "127.5.5.5",
    "0.0.0.0",
    "169.254.169.254", // cloud metadata endpoint
    "192.168.1.1",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
  ])("blocks %s", (host) => {
    expect(isBlockedHost(host)).toBe(true);
  });

  it.each(["example.com", "8.8.8.8", "172.32.0.1", "172.15.0.1", "193.168.1.1"])("allows %s", (host) => {
    expect(isBlockedHost(host)).toBe(false);
  });
});

describe("safeFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a blocked host without making any network request", async () => {
    await expect(safeFetch("http://localhost/")).rejects.toBeInstanceOf(BlockedHostError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the response directly when there's no redirect", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(200, { url: "https://example.com/" }));

    const response = await safeFetch("https://example.com/");

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("follows a redirect to an allowed host", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(fakeResponse(302, { location: "https://example.com/final" }))
      .mockResolvedValueOnce(fakeResponse(200, { url: "https://example.com/final" }));

    const response = await safeFetch("https://example.com/start");

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects when a redirect points at a blocked host — the core SSRF fix", async () => {
    // This is exactly what a live test couldn't cover: a public-looking
    // start URL whose server redirects to an internal address. Real
    // infrastructure isn't reachable in this sandbox; a mocked Location
    // header is.
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeResponse(302, { location: "http://169.254.169.254/latest/meta-data/" }),
    );

    await expect(safeFetch("https://example.com/")).rejects.toBeInstanceOf(BlockedHostError);
    expect(fetch).toHaveBeenCalledTimes(1); // never actually requests the blocked target
  });

  it("gives up after too many redirects instead of looping forever", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(302, { location: "https://example.com/loop" }));

    await expect(safeFetch("https://example.com/")).rejects.toThrow(/redirecionamentos/);
  });
});
