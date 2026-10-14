import { describe, expect, it } from "vitest";
import { parseIndexing } from "./indexing";

const page = (head: string) => `<html><head>${head}</head><body></body></html>`;

describe("parseIndexing", () => {
  it("finds noindex in a robots or googlebot meta tag", () => {
    expect(parseIndexing(page('<meta name="robots" content="noindex, nofollow">'), null).metaNoindex).toBe(true);
    expect(parseIndexing(page("<meta content='NOINDEX' name='googlebot'>"), null).metaNoindex).toBe(true);
    expect(parseIndexing(page('<meta name="robots" content="none">'), null).metaNoindex).toBe(true);
  });

  it("doesn't mistake other directives or other crawlers for noindex", () => {
    expect(parseIndexing(page('<meta name="robots" content="index, follow">'), null).metaNoindex).toBe(false);
    expect(parseIndexing(page('<meta name="robots" content="noimageindex">'), null).metaNoindex).toBe(false);
    expect(parseIndexing(page('<meta name="bingbot" content="noindex">'), null).metaNoindex).toBe(false);
  });

  it("doesn't read noindex from the description text or a commented-out tag", () => {
    expect(parseIndexing(page('<meta name="description" content="noindex">'), null).metaNoindex).toBe(false);
    expect(parseIndexing(page('<!-- <meta name="robots" content="noindex"> -->'), null).metaNoindex).toBe(false);
    expect(parseIndexing(page('<meta data-name="robots" content="noindex">'), null).metaNoindex).toBe(false);
  });

  it("reads X-Robots-Tag, with or without a crawler prefix", () => {
    expect(parseIndexing(page(""), "noindex").headerNoindex).toBe(true);
    expect(parseIndexing(page(""), "noarchive, NoIndex").headerNoindex).toBe(true);
    expect(parseIndexing(page(""), "googlebot: noindex").headerNoindex).toBe(true);
    expect(parseIndexing(page(""), "none").headerNoindex).toBe(true);
  });

  it("ignores X-Robots-Tag rules meant for other crawlers", () => {
    expect(parseIndexing(page(""), "otherbot: noindex").headerNoindex).toBe(false);
    expect(parseIndexing(page(""), "otherbot: noindex, nofollow").headerNoindex).toBe(false);
    expect(parseIndexing(page(""), "max-snippet: 20, nofollow").headerNoindex).toBe(false);
    expect(parseIndexing(page(""), null).headerNoindex).toBe(false);
  });

  it("doesn't take a valued directive for a crawler name", () => {
    expect(parseIndexing(page(""), "max-image-preview: large, noindex").headerNoindex).toBe(true);
  });
});
