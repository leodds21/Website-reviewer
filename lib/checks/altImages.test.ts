import { describe, expect, it } from "vitest";
import { parseAltImages } from "./altImages";

describe("parseAltImages", () => {
  it("counts images with a non-empty alt as fine", () => {
    const result = parseAltImages(`<img src="logo.png" alt="Site logo">`);

    expect(result.sampledCount).toBe(1);
    expect(result.missingAltCount).toBe(0);
  });

  it("flags a valueless alt attribute as missing, same as no alt at all", () => {
    // <img alt> with no value is the same as alt="" per the HTML spec —
    // decorative-image convention, but still counts as "no alt text" for
    // this check, matching what we verified against the real Wikipedia
    // markup earlier in the project.
    const result = parseAltImages(`<img src="logo.png" alt>`);

    expect(result.missingAltCount).toBe(1);
    expect(result.missingAltSrcs).toEqual(["logo.png"]);
  });

  it("flags an img with no alt attribute at all, reporting its src", () => {
    const result = parseAltImages(`<img src="banner.jpg">`);

    expect(result.missingAltCount).toBe(1);
    expect(result.missingAltSrcs).toEqual(["banner.jpg"]);
  });

  it("samples only the first 20 images on a page with many more", () => {
    const html = Array.from({ length: 50 }, (_, i) => `<img src="img${i}.png" alt="">`).join("\n");

    const result = parseAltImages(html);

    expect(result.sampledCount).toBe(20);
    expect(result.missingAltCount).toBe(20);
  });
});
