import { describe, expect, it } from "vitest";
import { aggregateScore } from "./score";
import { SCORE_SCENARIOS } from "./scoreScenarios";

// Pinned scores for four representative sites.
describe("score table", () => {
  const TABLE = {
    good: { overall: 99, performance: 96, seo: 100, accessibility: 99, security: 100 },
    average: { overall: 73, performance: 71, seo: 67, accessibility: 88, security: 67 },
    bad: { overall: 21, performance: 31, seo: 26, accessibility: 28, security: 0 },
    blocked: { overall: 100, performance: null, seo: null, accessibility: null, security: 100 },
  };

  for (const [name, expected] of Object.entries(TABLE)) {
    it(`keeps the ${name} site's scores`, () => {
      const { input, failures } = SCORE_SCENARIOS[name as keyof typeof SCORE_SCENARIOS];
      const score = aggregateScore(input, failures);
      expect({
        overall: score.overall,
        performance: score.performance.score,
        seo: score.seo.score,
        accessibility: score.accessibility.score,
        security: score.security.score,
      }).toEqual(expected);
    });
  }
});

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

  it("scores HTTPS that works without the http redirect as attention, not 0", () => {
    const noRedirect = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 100, seo: 88 } },
      https: { passed: true, finalUrl: "https://x.com/", redirectedFromHttp: false, noHttpRedirect: true },
    });

    expect(noRedirect.security.score).toBe(75); // média(50, 100)
    expect(noRedirect.security.severity).toBe("atencao");
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

  it("doesn't let missing hardening headers lower the security score: they're suggestions", () => {
    const result = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 95, "best-practices": 92, seo: 88 } },
      https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
      securityHeaders: { hasHsts: false, hasCsp: false, hasClickjackingProtection: false },
    });

    expect(result.security.score).toBe(96); // média(100, 92), headers listed as findings only
  });

  it("doesn't change the security score when securityHeaders wasn't provided", () => {
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

    expect(weakSeo.seo.score).toBe(13); // média(40, 0, 0): no title, no description
    expect(weakSeo.seo.severity).toBe("critico");
    expect(weakSeo.accessibility.score).toBe(Math.round((95 + 100 + 70) / 3));
  });

  it("never scores sitemap.xml or robots.txt, found, missing or undetermined", () => {
    // A missing sitemap is a suggestion and a missing robots.txt isn't a
    // problem at all; neither may cost points.
    const undetermined = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 60 } },
      sitemapRobots: { hasSitemap: null, hasRobotsTxt: null },
    });

    expect(undetermined.seo.score).toBe(60);

    const confirmedMissing = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 60 } },
      sitemapRobots: { hasSitemap: false, hasRobotsTxt: false },
    });

    expect(confirmedMissing.seo.score).toBe(60);
  });

  it("blends brokenLinks into the SEO average, scored by the reachable ratio", () => {
    const result = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 100 } },
      brokenLinks: { checkedCount: 4, brokenCount: 1, brokenUrls: ["https://x.com/dead"] },
    });

    expect(result.seo.score).toBe(Math.round((100 + 75) / 2)); // média(100, 3/4*100)
  });

  it("scores brokenLinks as clean when the page had no links to check", () => {
    const result = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 60 } },
      brokenLinks: { checkedCount: 0, brokenCount: 0, brokenUrls: [] },
    });

    expect(result.seo.score).toBe(80); // média(60, 100)
  });

  it("marks every category indisponivel when no check ran at all", () => {
    const nothing = aggregateScore({});

    expect(nothing.performance).toMatchObject({ score: null, severity: "indisponivel" });
    expect(nothing.seo).toMatchObject({ score: null, severity: "indisponivel" });
    expect(nothing.accessibility).toMatchObject({ score: null, severity: "indisponivel" });
    expect(nothing.security).toMatchObject({ score: null, severity: "indisponivel" });
    expect(nothing.overall).toBe(0);
  });

  it("makes security indisponivel when https didn't run, even if pagespeed did", () => {
    const result = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 92, seo: 90 } },
    });

    expect(result.security).toMatchObject({ score: null, severity: "indisponivel" });
    expect(result.performance.score).toBe(90);
  });

  it("computes overall from only the categories that have data (camara.rio-style: only security ran)", () => {
    const onlySecurityRan = aggregateScore({
      https: { passed: false, finalUrl: "https://x.com", redirectedFromHttp: false, certificateError: true },
    });

    expect(onlySecurityRan.security.score).toBe(0);
    expect(onlySecurityRan.performance).toMatchObject({ score: null, severity: "indisponivel" });
    expect(onlySecurityRan.overall).toBe(0); // only security contributed, and it's 0
    expect(onlySecurityRan.overallSeverity).toBe("critico");
  });

  it("says why a category couldn't be measured, preferring the most explanatory reason", () => {
    const result = aggregateScore(
      { https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false } },
      { pagespeed: "timeout", page: "blocked", sitemapRobots: "blocked", brokenLinks: "blocked" },
    );

    expect(result.performance).toEqual({ score: null, severity: "indisponivel", reason: "timeout" });
    // accessibility draws on pagespeed (timeout) and the page (blocked): blocked wins.
    expect(result.accessibility).toEqual({ score: null, severity: "indisponivel", reason: "blocked" });
  });

  it("flags a category partial when it scored but some of its sources failed", () => {
    const result = aggregateScore(
      {
        https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
        brokenLinks: { checkedCount: 4, brokenCount: 0, brokenUrls: [] },
      },
      { pagespeed: "quota", page: "blocked" },
    );

    expect(result.seo).toMatchObject({ score: 100, partial: true });
    expect(result.security).toMatchObject({ score: 100, partial: true });
  });

  it("scores seo and accessibility from Lighthouse's audits when our fetch of the page was refused", () => {
    const result = aggregateScore(
      {
        pagespeed: {
          scores: { performance: 70, accessibility: 80, "best-practices": 90, seo: 60 },
          hasTitle: true,
          hasDescription: false,
          hasViewport: true,
          imagesHaveAlt: true,
        },
      },
      { page: "blocked", brokenLinks: "blocked", sitemapRobots: "blocked" },
    );

    expect(result.seo.score).toBe(Math.round((60 + 100 + 0) / 3));
    // Lighthouse's image-alt is already inside its accessibility score.
    expect(result.accessibility.score).toBe(Math.round((80 + 100) / 2));
  });

  it("does not flag a complete category as partial", () => {
    const result = aggregateScore(
      { pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 } } },
      { page: "blocked" },
    );

    expect(result.performance).toMatchObject({ score: 90, partial: false });
  });

  it("does not call a failed https check partial: it's a complete answer on its own", () => {
    const result = aggregateScore(
      { https: { passed: false, finalUrl: "http://x.com", redirectedFromHttp: false } },
      { pagespeed: "timeout" },
    );

    expect(result.security).toMatchObject({ score: 0, partial: false });
  });

  it("lets seo score from Lighthouse alone when our own page fetch didn't run", () => {
    const result = aggregateScore({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 60 } },
      sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
    });

    expect(result.seo.score).toBe(60);
  });
});

describe("score explanation (components)", () => {
  const categories = ["performance", "seo", "accessibility", "security"] as const;

  for (const [name, { input, failures }] of Object.entries(SCORE_SCENARIOS)) {
    it(`explains every ${name} score with the measurements it was averaged from`, () => {
      const score = aggregateScore(input, failures);
      for (const key of categories) {
        const category = score[key];
        if (category.score === null) continue;
        const components = category.components ?? [];
        const values = components.map((component) => component.value);
        // The score is the average of exactly these measurements…
        expect(Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)).toBe(category.score);
        // …and what they took off adds up to exactly what's missing from 100.
        expect(components.reduce((sum, component) => sum + component.lost, 0)).toBe(100 - category.score);
        for (const component of components) {
          expect(Number.isInteger(component.lost)).toBe(true);
          expect(component.lost).toBeGreaterThanOrEqual(0);
          // Each shown loss is within a point of the exact share.
          expect(Math.abs(component.lost - (100 - component.value) / components.length)).toBeLessThan(1);
        }
      }
    });
  }

  it("spells out the average site's SEO: description missing costs the most", () => {
    const { seo } = aggregateScore(SCORE_SCENARIOS.average.input);
    expect(seo.score === null ? [] : seo.components).toEqual([
      { key: "google-seo", value: 92, lost: 2 },
      { key: "title", value: 100, lost: 0 },
      { key: "description", value: 0, lost: 25 },
      { key: "links", value: 75, lost: 6, count: 8 },
    ]);
  });

  it("closes the sum when a three-way average doesn't divide evenly", () => {
    const { accessibility } = aggregateScore({
      pagespeed: { scores: { accessibility: 90 } },
      metaTags: { hasViewport: false, hasTitle: true, title: "X", hasDescription: true, description: "d" },
      altImages: { sampledCount: 3, missingAltCount: 1, missingAltSrcs: ["a"] },
    });
    // (90 + 0 + 66.67) / 3 = 52.2 → 52; exact losses 3.33 + 33.33 + 11.11 = 47.8 → 48.
    expect(accessibility.score).toBe(52);
    const components = accessibility.score === null ? [] : (accessibility.components ?? []);
    expect(components.map((component) => component.lost)).toEqual([3, 34, 11]);
  });

  it("says how many elements a share was taken over, 0 when there was nothing to check", () => {
    const { seo, accessibility } = aggregateScore({
      altImages: { sampledCount: 0, missingAltCount: 0, missingAltSrcs: [] },
      brokenLinks: { checkedCount: 0, brokenCount: 0, brokenUrls: [] },
    });
    expect(seo.score === null ? [] : seo.components).toEqual([{ key: "links", value: 100, lost: 0, count: 0 }]);
    expect(accessibility.score === null ? [] : accessibility.components).toEqual([{ key: "alt-images", value: 100, lost: 0, count: 0 }]);
  });

  it("explains a site without HTTPS with that one measurement, at 0", () => {
    const { security } = aggregateScore(SCORE_SCENARIOS.bad.input);
    expect(security.score === null ? [] : security.components).toEqual([{ key: "https", value: 0, lost: 100 }]);
  });

  it("has nothing to explain for a category that couldn't be measured", () => {
    const { performance } = aggregateScore(SCORE_SCENARIOS.blocked.input, SCORE_SCENARIOS.blocked.failures);
    expect(performance).toEqual({ score: null, severity: "indisponivel", reason: "blocked" });
  });

  it("gives the same explanation for the same results", () => {
    expect(aggregateScore(SCORE_SCENARIOS.average.input)).toEqual(aggregateScore(SCORE_SCENARIOS.average.input));
  });
});
