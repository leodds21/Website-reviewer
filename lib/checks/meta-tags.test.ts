import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkMetaTags } from "./meta-tags";

function fakeHtmlResponse(html: string): Response {
  return {
    status: 200,
    headers: new Headers(),
    url: "https://example.com/",
    ok: true,
    text: async () => html,
  } as Response;
}

describe("checkMetaTags", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects viewport, title and description when all are present", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeHtmlResponse(`<html><head>
        <meta name="viewport" content="width=device-width">
        <title>Papelaria Central</title>
        <meta name="description" content="Papelaria em Curitiba">
      </head></html>`),
    );

    const result = await checkMetaTags("example.com");

    expect(result.hasViewport).toBe(true);
    expect(result.hasTitle).toBe(true);
    expect(result.title).toBe("Papelaria Central");
    expect(result.hasDescription).toBe(true);
    expect(result.description).toBe("Papelaria em Curitiba");
  });

  it("reports everything missing on a bare page", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeHtmlResponse("<html><head></head><body></body></html>"));

    const result = await checkMetaTags("example.com");

    expect(result.hasViewport).toBe(false);
    expect(result.hasTitle).toBe(false);
    expect(result.title).toBeNull();
    expect(result.hasDescription).toBe(false);
    expect(result.description).toBeNull();
  });

  it("finds the description even when content= comes before name= (regression test)", async () => {
    // The regex used to require name= first and silently missed real-world
    // markup with the attributes in the other order — this is exactly the
    // bug caught in the code review and fixed in the same commit.
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeHtmlResponse(`<meta content="Reversed attribute order" name="description">`),
    );

    const result = await checkMetaTags("example.com");

    expect(result.hasDescription).toBe(true);
    expect(result.description).toBe("Reversed attribute order");
  });
});
