import { describe, expect, it } from "vitest";
import { detectTech } from "./techDetect";

describe("detectTech", () => {
  it("reports null when the page matches no known platform", () => {
    const result = detectTech("<html><head><title>Papelaria Central</title></head><body>Hello</body></html>");

    expect(result.platform).toBeNull();
  });

  it("detects WordPress from a wp-content path", () => {
    const result = detectTech('<html><head><link rel="stylesheet" href="/wp-content/themes/x/style.css"></head></html>');

    expect(result.platform).toBe("wordpress");
  });

  it("detects WordPress from its generator meta tag", () => {
    const result = detectTech('<html><head><meta name="generator" content="WordPress 6.4"></head></html>');

    expect(result.platform).toBe("wordpress");
  });

  it("detects Wix from its static asset host", () => {
    const result = detectTech('<html><head><script src="https://static.wixstatic.com/foo.js"></script></head></html>');

    expect(result.platform).toBe("wix");
  });

  it("detects Squarespace from its static asset host", () => {
    const result = detectTech('<html><head><link href="https://static1.squarespace.com/style.css"></head></html>');

    expect(result.platform).toBe("squarespace");
  });

  it("detects Shopify from its CDN host", () => {
    const result = detectTech('<html><head><script src="https://cdn.shopify.com/s/files/theme.js"></script></head></html>');

    expect(result.platform).toBe("shopify");
  });
});
