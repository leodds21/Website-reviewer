import { describe, expect, it } from "vitest";
import { parseSocialPreview } from "./socialPreview";

describe("parseSocialPreview", () => {
  it("lists the Open Graph tags that are missing or empty", () => {
    const html = '<meta property="og:title" content="Escritório"><meta property="og:image" content="">';
    expect(parseSocialPreview(html).missing).toEqual(["og:description", "og:image"]);
  });

  it("accepts name= as well as property=", () => {
    const html = '<meta name="og:title" content="a"><meta name="og:description" content="b"><meta property="OG:IMAGE" content="c.png">';
    expect(parseSocialPreview(html).missing).toEqual([]);
  });

  it("doesn't count Twitter tags as Open Graph", () => {
    expect(parseSocialPreview('<meta name="twitter:title" content="a">').missing).toHaveLength(3);
  });
});
