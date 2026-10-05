import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookup } from "node:dns/promises";
import { BlockedHostError, isBlockedHost, readTextCapped, safeFetch } from "./safeFetch";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

// dns.promises.lookup is overloaded (single address vs array vs family
// variants), which trips up vi.mocked()'s inferred call signature — this
// pins mock results to the shape safeFetch actually requests (all: true).
function dnsResult(...addresses: string[]): Awaited<ReturnType<typeof lookup>> {
  return addresses.map((address) => ({ address, family: 4 })) as unknown as Awaited<ReturnType<typeof lookup>>;
}

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
    "0.1.2.3", // 0.0.0.0/8
    "100.64.1.1", // CGNAT
    "169.254.169.254", // cloud metadata endpoint
    "192.168.1.1",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "::1", // IPv6 loopback
    "[::1]", // same, as URL.hostname actually returns it (bracketed)
    "fe80::1", // IPv6 link-local
    "fd00::1", // IPv6 unique local
    "[fd12:3456:789a::1]",
    "::ffff:127.0.0.1", // IPv4-mapped IPv6, dotted form
    "::ffff:7f00:1", // same, hex form
    "::", // IPv6 unspecified — connecting to it lands on localhost
    "[::]",
    "192.0.2.10", // TEST-NET-1
    "198.18.0.1", // benchmarking
    "203.0.113.5", // TEST-NET-3
    "224.0.0.1", // multicast
    "240.0.0.1", // reserved
    "255.255.255.255", // broadcast
    "::7f00:1", // IPv4-compatible IPv6 for 127.0.0.1
    "64:ff9b::7f00:1", // NAT64-embedded 127.0.0.1
    "2002:7f00:1::", // 6to4-embedded 127.0.0.1
    "ff02::1", // IPv6 multicast
  ])("blocks %s", (host) => {
    expect(isBlockedHost(host)).toBe(true);
  });

  it.each([
    "example.com",
    "8.8.8.8",
    "172.32.0.1",
    "172.15.0.1",
    "193.168.1.1",
    "2001:4860:4860::8888", // Google public DNS, IPv6
    "::ffff:8.8.8.8", // IPv4-mapped but the mapped address is public
  ])("allows %s", (host) => {
    expect(isBlockedHost(host)).toBe(false);
  });
});

describe("safeFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    // Default: any hostname resolves to a plain public address, so
    // tests that aren't specifically about DNS don't have to think
    // about it.
    vi.mocked(lookup).mockResolvedValue(dnsResult("93.184.216.34"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it.each(["file:///etc/passwd", "data:text/html,pwned", "gopher://example.com/", "ftp://example.com/"])(
    "rejects the non-http(s) protocol %s outright",
    async (url) => {
      await expect(safeFetch(url)).rejects.toBeInstanceOf(BlockedHostError);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("rejects a redirect that switches to a non-http(s) protocol", async () => {
    // file:/data: URLs carry an empty hostname *and* an empty port, so
    // the host and port checks both wave them through — only the
    // protocol check catches this, and it has to run on every hop, not
    // just the entry URL.
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(302, { location: "file:///etc/passwd" }));

    await expect(safeFetch("https://example.com/")).rejects.toBeInstanceOf(BlockedHostError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-standard port even on an otherwise-allowed host", async () => {
    // A public hostname is a free pass to probe internal services on
    // other ports (a database, an admin panel) if only the host is
    // checked — 80/443/default are the only legitimate targets for a
    // "fetch this webpage" tool.
    await expect(safeFetch("https://example.com:6379/")).rejects.toBeInstanceOf(BlockedHostError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows the default https port explicitly written as :443", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(200, { url: "https://example.com/" }));

    const response = await safeFetch("https://example.com:443/");

    expect(response.status).toBe(200);
  });

  it("rejects a literal blocked host without making any network request or DNS lookup", async () => {
    await expect(safeFetch("http://localhost/")).rejects.toBeInstanceOf(BlockedHostError);
    expect(fetch).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects a hostname that resolves to a blocked IP — not just a literal blocked IP", async () => {
    // isBlockedHost alone only catches the URL literally containing a
    // blocked address; this is the case it can't see on its own — a
    // normal-looking domain whose DNS record points at an internal
    // address (e.g. an attacker-controlled zone, or cloud metadata via
    // a rebinding-style domain).
    vi.mocked(lookup).mockResolvedValueOnce(dnsResult("169.254.169.254"));

    await expect(safeFetch("https://looks-public.example/")).rejects.toBeInstanceOf(BlockedHostError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not block when DNS resolution itself fails — lets the real fetch surface that error", async () => {
    vi.mocked(lookup).mockRejectedValueOnce(new Error("ENOTFOUND"));
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(200, { url: "https://example.com/" }));

    const response = await safeFetch("https://example.com/");

    expect(response.status).toBe(200);
  });

  it("returns the response directly when there's no redirect", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(200, { url: "https://example.com/" }));

    const response = await safeFetch("https://example.com/");

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("identifies itself with a real user agent and accept headers, keeping any the caller set", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(200, { url: "https://example.com/" }));

    await safeFetch("https://example.com/", { headers: { Accept: "text/plain" } });

    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.get("user-agent")).toMatch(/lsdiasScan/);
    expect(headers.get("accept-language")).toMatch(/pt-BR/);
    expect(headers.get("accept")).toBe("text/plain");
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

describe("readTextCapped", () => {
  function streamingResponse(chunks: string[]): Response {
    const encoder = new TextEncoder();
    let index = 0;
    return {
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          if (index >= chunks.length) return controller.close();
          controller.enqueue(encoder.encode(chunks[index++]));
        },
      }),
    } as Response;
  }

  it("reads a normal body in full", async () => {
    expect(await readTextCapped(streamingResponse(["<html>", "ok", "</html>"]))).toBe("<html>ok</html>");
  });

  it("returns an empty string for a body-less response", async () => {
    expect(await readTextCapped({ body: null } as Response)).toBe("");
  });

  it("stops at the cap instead of reading an oversized body into memory", async () => {
    const result = await readTextCapped(streamingResponse(["a".repeat(50), "b".repeat(50)]), 60);

    expect(result).toHaveLength(60);
    expect(result.startsWith("a".repeat(50))).toBe(true);
  });

  it("stops on an endless body rather than hanging or exhausting memory", async () => {
    // The realistic hostile case: a server that never closes the
    // response. response.text() would keep buffering until the process
    // dies; this has to return.
    const encoder = new TextEncoder();
    const endless = {
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(encoder.encode("x".repeat(1024)));
        },
      }),
    } as Response;

    const result = await readTextCapped(endless, 4096);

    expect(result).toHaveLength(4096);
  });
});
