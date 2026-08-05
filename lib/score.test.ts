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

  it("blends security headers into the security score, alongside https + best-practices", () => {
    const result = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 92, seo: 88 } },
      https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
      securityHeaders: { hasHsts: true, hasCsp: false, hasClickjackingProtection: true }, // 2/3 -> ~67
    });

    expect(result.security.score).toBe(Math.round((100 + 92 + (2 / 3) * 100) / 3));
  });

  it("doesn't change the security score when securityHeaders wasn't provided", () => {
    // Matches the pre-existing "média(100, 92)" test above — absence
    // of the new input shouldn't silently shift old behavior.
    const result = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 92, seo: 88 } },
      https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
    });

    expect(result.security.score).toBe(96);
  });

  it("blends seo/accessibility signals beyond Lighthouse alone", () => {
    const weakSeo = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 92, seo: 40 } },
      https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
      metaTags: { hasViewport: true, hasTitle: false, title: null, hasDescription: false, description: null },
      altImages: { sampledCount: 10, missingAltCount: 3, missingAltSrcs: ["a.png", "b.png", "c.png"] },
      sitemapRobots: { hasSitemap: false, hasRobotsTxt: true },
    });

    expect(weakSeo.seo.score).toBe(28); // média(40, 0, 0, 0, 100)
    expect(weakSeo.seo.severity).toBe("critico");
    expect(weakSeo.accessibility.score).toBe(Math.round((95 + 100 + 70) / 3));
  });

  it("keeps an undetermined sitemap/robots probe out of the SEO average", () => {
    // null means "we couldn't reach the host to find out", so it must
    // contribute nothing — scoring it as 0, like a confirmed absence,
    // would invent a penalty from a measurement we never made.
    const undetermined = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 60 } },
      sitemapRobots: { hasSitemap: null, hasRobotsTxt: null },
    });

    expect(undetermined.seo.score).toBe(60); // pagespeed's seo alone

    const confirmedMissing = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 60 } },
      sitemapRobots: { hasSitemap: false, hasRobotsTxt: false },
    });

    expect(confirmedMissing.seo.score).toBe(20); // média(60, 0, 0)
  });

  it("marks every category indisponivel when no check ran at all", () => {
    const nothing = aggregateScore({});

    expect(nothing.performance).toEqual({ score: null, severity: "indisponivel" });
    expect(nothing.seo).toEqual({ score: null, severity: "indisponivel" });
    expect(nothing.accessibility).toEqual({ score: null, severity: "indisponivel" });
    expect(nothing.security).toEqual({ score: null, severity: "indisponivel" });
    expect(nothing.overall).toBe(0);
  });

  it("makes security indisponivel when https didn't run, even if pagespeed did", () => {
    // best-practices alone isn't a security signal — it's a bonus on
    // top of a confirmed https pass, never a standalone proxy for it.
    const result = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 92, seo: 90 } },
    });

    expect(result.security).toEqual({ score: null, severity: "indisponivel" });
    expect(result.performance.score).toBe(90);
  });

  it("computes overall from only the categories that have data (camara.rio-style: only security ran)", () => {
    const onlySecurityRan = aggregateScore({
      https: { passed: false, finalUrl: "https://x.com", redirectedFromHttp: false, certificateError: true },
    });

    expect(onlySecurityRan.security.score).toBe(0);
    expect(onlySecurityRan.performance).toEqual({ score: null, severity: "indisponivel" });
    expect(onlySecurityRan.overall).toBe(0); // only security contributed, and it's 0
    expect(onlySecurityRan.overallSeverity).toBe("critico");
  });

  it("lets seo score from partial sources when metaTags is missing but pagespeed and sitemap ran", () => {
    const result = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 60 } },
      sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
    });

    expect(result.seo.score).toBe(Math.round((60 + 100 + 100) / 3));
  });
});
