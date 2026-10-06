import { describe, expect, it } from "vitest";
import { derivePasses } from "./passes";

const codes = (input: Parameters<typeof derivePasses>[0]) => derivePasses(input).map((pass) => pass.code);

describe("derivePasses", () => {
  it("lists everything a healthy site got right", () => {
    expect(
      codes({
        https: { passed: true, finalUrl: "https://x.com/", redirectedFromHttp: true },
        securityHeaders: { hasHsts: true, hasCsp: true, hasClickjackingProtection: true },
        metaTags: { hasViewport: true, hasTitle: true, title: "Escritório X", hasDescription: true, description: "Y" },
        altImages: { sampledCount: 6, missingAltCount: 0, missingAltSrcs: [] },
        sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
        brokenLinks: { checkedCount: 8, brokenCount: 0, brokenUrls: [] },
        pagespeed: { scores: { performance: 95 }, lcpSeconds: 1.8, clsValue: 0.02 },
      }),
    ).toEqual(["https", "security-headers", "title", "description", "viewport", "alt-images", "sitemap", "links", "fast-load", "stable-layout"]);
  });

  it("says nothing about checks that didn't run, instead of an unverified pass", () => {
    expect(codes({})).toEqual([]);
  });

  it("doesn't count HTTPS that visitors aren't sent to, nor a broken certificate", () => {
    expect(codes({ https: { passed: true, finalUrl: "https://x.com/", redirectedFromHttp: false, noHttpRedirect: true } })).toEqual([]);
    expect(codes({ https: { passed: false, finalUrl: "https://x.com/", redirectedFromHttp: false, certificateError: true } })).toEqual([]);
  });

  it("needs all three hardening headers, over a working HTTPS", () => {
    const https = { passed: true, finalUrl: "https://x.com/", redirectedFromHttp: true };
    expect(codes({ https, securityHeaders: { hasHsts: true, hasCsp: false, hasClickjackingProtection: true } })).toEqual(["https"]);
  });

  it("doesn't call a generic title a pass", () => {
    expect(codes({ metaTags: { hasViewport: false, hasTitle: true, title: "Home", hasDescription: false, description: null } })).toEqual([]);
  });

  it("falls back to Lighthouse when our own fetch of the page failed", () => {
    expect(
      codes({ pagespeed: { scores: {}, hasTitle: true, hasDescription: false, hasViewport: true, imagesHaveAlt: true } }),
    ).toEqual(["title", "viewport", "alt-images"]);
  });

  it("has nothing to say about images or links when there were none to check", () => {
    expect(
      codes({
        altImages: { sampledCount: 0, missingAltCount: 0, missingAltSrcs: [] },
        brokenLinks: { checkedCount: 0, brokenCount: 0, brokenUrls: [] },
      }),
    ).toEqual([]);
  });

  it("holds speed and stability to Google's 'good' line, not just 'not poor'", () => {
    expect(codes({ pagespeed: { scores: {}, lcpSeconds: 3.1, clsValue: 0.15 } })).toEqual([]);
    expect(codes({ pagespeed: { scores: {}, lcpSeconds: 2.5, clsValue: 0.1 } })).toEqual(["fast-load", "stable-layout"]);
  });
});
