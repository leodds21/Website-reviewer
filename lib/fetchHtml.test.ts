import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHtml } from "./fetchHtml";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34" }]) }));

function fakeHtmlResponse(html: string): Response {
  return {
    status: 200,
    headers: new Headers(),
    url: "https://example.com/",
    ok: true,
    text: async () => html,
  } as Response;
}

describe("fetchHtml", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the fetched HTML", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeHtmlResponse("<title>Example</title>"));

    const html = await fetchHtml("example.com");

    expect(html).toBe("<title>Example</title>");
  });

  it("defaults to https when no scheme is given", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeHtmlResponse(""));

    await fetchHtml("example.com");

    const requestedUrl = vi.mocked(fetch).mock.calls[0][0] as URL;
    expect(requestedUrl.toString()).toBe("https://example.com/");
  });

  it("rejects a blocked host without making any request", async () => {
    await expect(fetchHtml("http://localhost/")).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
