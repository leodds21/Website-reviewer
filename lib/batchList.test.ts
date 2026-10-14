import { describe, expect, it } from "vitest";
import { MAX_BATCH_URLS, parseBatchList } from "./batchList";

describe("parseBatchList", () => {
  it("takes one address per line, trimmed, without blank lines", () => {
    expect(parseBatchList("  site-a.com.br \n\n\r\nhttps://site-b.com/\n").urls).toEqual(["site-a.com.br", "https://site-b.com/"]);
  });

  it("drops repeats of the same site, written differently", () => {
    expect(parseBatchList("Site.com\nhttps://site.com/\nsite.com").urls).toEqual(["Site.com"]);
  });

  it("keeps different paths and schemes apart, like the cache does", () => {
    expect(parseBatchList("site.com\nsite.com/contato\nhttp://site.com").urls).toHaveLength(3);
  });

  it("caps the list and says how many were left out", () => {
    const text = Array.from({ length: MAX_BATCH_URLS + 3 }, (_, i) => `site-${i}.com`).join("\n");
    const { urls, overLimit } = parseBatchList(text);

    expect(urls).toHaveLength(MAX_BATCH_URLS);
    expect(overLimit).toBe(3);
  });
});
