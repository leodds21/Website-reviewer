import { describe, expect, it } from "vitest";
import { parseAltImages } from "./altImages";

describe("parseAltImages", () => {
  it("counts images with a non-empty alt as fine", () => {
    const result = parseAltImages(`<img src="logo.png" alt="Site logo">`);

    expect(result.sampledCount).toBe(1);
    expect(result.missingAltCount).toBe(0);
  });

  it.each([
    ["an empty alt", `<img src="divider.png" alt="">`],
    ["a valueless alt", `<img src="divider.png" alt>`],
    ["a self-closing tag with a bare alt", `<img src="divider.png" alt/>`],
    ["role=presentation", `<img src="divider.png" role="presentation">`],
    ["aria-hidden", `<img src="divider.png" aria-hidden="true">`],
  ])("accepts %s as a deliberate decorative image, per WCAG", (_label, html) => {
    expect(parseAltImages(html).missingAltCount).toBe(0);
  });

  it("isn't fooled by an attribute that merely ends in 'alt'", () => {
    expect(parseAltImages(`<img src="x.png" data-alt="photo">`).missingAltCount).toBe(1);
  });

  it("flags an img with no alt attribute at all, reporting its src", () => {
    const result = parseAltImages(`<img src="banner.jpg">`);

    expect(result.missingAltCount).toBe(1);
    expect(result.missingAltSrcs).toEqual(["banner.jpg"]);
  });

  it("samples only the first 20 images on a page with many more", () => {
    const html = Array.from({ length: 50 }, (_, i) => `<img src="img${i}.png">`).join("\n");

    const result = parseAltImages(html);

    expect(result.sampledCount).toBe(20);
    expect(result.missingAltCount).toBe(20);
  });
});
