import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHtml } from "./fetchHtml";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34" }]) }));

// A real stream, since readTextCapped reads the body incrementally.
function fakeHtmlResponse(html: string, headers?: HeadersInit): Response {
  return {
    status: 200,
    headers: new Headers(headers),
    url: "https://example.com/",
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        if (html) controller.enqueue(new TextEncoder().encode(html));
        controller.close();
      },
    }),
  } as Response;
}

describe("fetchHtml", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the fetched HTML with the response headers", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeHtmlResponse("<title>Example</title>", { "x-robots-tag": "noindex" }));

    const { html, headers } = await fetchHtml("example.com");

    expect(html).toBe("<title>Example</title>");
    expect(headers.get("x-robots-tag")).toBe("noindex");
  });

  it("returns the address the redirects ended at", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ...fakeHtmlResponse(""), status: 301, ok: false, headers: new Headers({ location: "/pt/" }) } as Response)
      .mockResolvedValueOnce({ ...fakeHtmlResponse("<title>x</title>"), url: "https://example.com/pt/" } as Response);

    expect((await fetchHtml("example.com")).finalUrl).toBe("https://example.com/pt/");
  });

  it("defaults to https when no scheme is given", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeHtmlResponse(""));

    await fetchHtml("example.com");

    const requestedUrl = vi.mocked(fetch).mock.calls[0][0] as URL;
    expect(requestedUrl.toString()).toBe("https://example.com/");
  });

  it("rejects a non-2xx response instead of parsing a bot wall or error page as the site", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ...fakeHtmlResponse("<title>Just a moment...</title>"), status: 403, ok: false } as Response);

    await expect(fetchHtml("example.com")).rejects.toThrow(/403/);
  });

  it("rejects a blocked host without making any request", async () => {
    await expect(fetchHtml("http://localhost/")).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
