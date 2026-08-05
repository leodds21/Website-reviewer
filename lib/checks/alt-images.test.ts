import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAltImages } from "./alt-images";

// checkAltImages goes through safeFetch, which resolves DNS to check
// for a blocked IP before every request — mocked here so the test
// doesn't depend on real DNS, same as fetch itself.
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

describe("checkAltImages", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("counts images with a non-empty alt as fine", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeHtmlResponse(`<img src="logo.png" alt="Site logo">`));

    const result = await checkAltImages("example.com");

    expect(result.sampledCount).toBe(1);
    expect(result.missingAltCount).toBe(0);
  });

  it("flags a valueless alt attribute as missing, same as no alt at all", async () => {
    // <img alt> with no value is the same as alt="" per the HTML spec —
    // decorative-image convention, but still counts as "no alt text" for
    // this check, matching what we verified against the real Wikipedia
    // markup earlier in the project.
    vi.mocked(fetch).mockResolvedValueOnce(fakeHtmlResponse(`<img src="logo.png" alt>`));

    const result = await checkAltImages("example.com");

    expect(result.missingAltCount).toBe(1);
    expect(result.missingAltSrcs).toEqual(["logo.png"]);
  });

  it("flags an img with no alt attribute at all, reporting its src", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeHtmlResponse(`<img src="banner.jpg">`));

    const result = await checkAltImages("example.com");

    expect(result.missingAltCount).toBe(1);
    expect(result.missingAltSrcs).toEqual(["banner.jpg"]);
  });

  it("samples only the first 20 images on a page with many more", async () => {
    const html = Array.from({ length: 50 }, (_, i) => `<img src="img${i}.png" alt="">`).join("\n");
    vi.mocked(fetch).mockResolvedValueOnce(fakeHtmlResponse(html));

    const result = await checkAltImages("example.com");

    expect(result.sampledCount).toBe(20);
    expect(result.missingAltCount).toBe(20);
  });
});
