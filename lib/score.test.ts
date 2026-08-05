import { describe, expect, it } from "vitest";
import { aggregateScore } from "./score";

describe("aggregateScore", () => {
  it("blends https + best-practices into security, and lands on severity ok for a strong site", () => {
    const strongSite = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 92, seo: 88 } },
      https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
      metaTags: { hasViewport: true, hasTitle: true, title: "X", hasDescription: true, description: "Y" },
      altImages: { sampledCount: 10, missingAltCount: 0, missingAltSrcs: [] },
      sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
    });

    expect(strongSite.security.score).toBe(96); // média(100, 92)
    expect(strongSite.overallSeverity).toBe("ok");
  });

  it("drives security straight to 0 when https fails, regardless of everything else", () => {
    const noHttps = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 92, seo: 88 } },
      https: { passed: false, finalUrl: "http://x.com", redirectedFromHttp: false },
      metaTags: { hasViewport: true, hasTitle: true, title: "X", hasDescription: true, description: "Y" },
      altImages: { sampledCount: 10, missingAltCount: 0, missingAltSrcs: [] },
      sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
    });

    expect(noHttps.security.score).toBe(0);
    expect(noHttps.security.severity).toBe("critico");
  });

  it("blends seo/accessibility signals beyond Lighthouse alone", () => {
    const weakSeo = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 92, seo: 40 } },
      https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
      metaTags: { hasViewport: true, hasTitle: false, title: null, hasDescription: false, description: null },
      altImages: { sampledCount: 10, missingAltCount: 3, missingAltSrcs: ["a.png", "b.png", "c.png"] },
      sitemapRobots: { hasSitemap: false, hasRobotsTxt: true },
    });

    expect(weakSeo.seo.score).toBe(10); // média(40, 0, 0, 0)
    expect(weakSeo.seo.severity).toBe("critico");
    expect(weakSeo.accessibility.score).toBe(Math.round((95 + 100 + 70) / 3));
  });
});
