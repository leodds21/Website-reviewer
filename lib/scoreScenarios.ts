import type { CheckResults } from "./checkResults";
import type { CheckFailures } from "./checkFailure";

/**
 * Four representative inputs shared by the score and ranking tests: a
 * healthy site, an average one, one with serious problems, and one
 * that blocked most of the checks. Kept in one place so the tests that
 * pin today's scores and the ones checking the explanation and the
 * ranking all look at the very same data.
 */
export const SCORE_SCENARIOS: Record<"good" | "average" | "bad" | "blocked", { input: Partial<CheckResults>; failures: CheckFailures }> = {
  good: {
    input: {
      pagespeed: { scores: { performance: 96, accessibility: 98, "best-practices": 100, seo: 100 }, lcpSeconds: 1.4, clsValue: 0.01 },
      https: { passed: true, finalUrl: "https://good.example/", redirectedFromHttp: true },
      securityHeaders: { hasHsts: true, hasCsp: true, hasClickjackingProtection: true },
      metaTags: { hasViewport: true, hasTitle: true, title: "Escritório Bom", hasDescription: true, description: "d" },
      altImages: { sampledCount: 8, missingAltCount: 0, missingAltSrcs: [] },
      sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
      brokenLinks: { checkedCount: 10, brokenCount: 0, brokenUrls: [] },
    },
    failures: {},
  },
  average: {
    input: {
      pagespeed: { scores: { performance: 71, accessibility: 88, "best-practices": 83, seo: 92 }, lcpSeconds: 3.4, clsValue: 0.05, hasColorContrastIssues: true },
      https: { passed: true, finalUrl: "https://average.example/", redirectedFromHttp: false, noHttpRedirect: true },
      securityHeaders: { hasHsts: false, hasCsp: false, hasClickjackingProtection: false },
      metaTags: { hasViewport: true, hasTitle: true, title: "Home", hasDescription: false, description: null },
      altImages: { sampledCount: 12, missingAltCount: 3, missingAltSrcs: ["a.png", "b.png", "c.png"] },
      sitemapRobots: { hasSitemap: false, hasRobotsTxt: true },
      brokenLinks: { checkedCount: 8, brokenCount: 2, brokenUrls: ["https://average.example/x", "https://average.example/y"] },
    },
    failures: {},
  },
  bad: {
    input: {
      pagespeed: { scores: { performance: 31, accessibility: 62, "best-practices": 58, seo: 70 }, lcpSeconds: 7.9, clsValue: 0.31, ttfbMs: 2400 },
      https: { passed: false, finalUrl: "http://bad.example/", redirectedFromHttp: false },
      metaTags: { hasViewport: false, hasTitle: false, title: null, hasDescription: false, description: null },
      altImages: { sampledCount: 9, missingAltCount: 7, missingAltSrcs: ["1", "2", "3", "4", "5", "6", "7"] },
      sitemapRobots: { hasSitemap: false, hasRobotsTxt: false },
      brokenLinks: { checkedCount: 6, brokenCount: 4, brokenUrls: ["a", "b", "c", "d"] },
    },
    failures: {},
  },
  blocked: {
    input: {
      https: { passed: true, finalUrl: "https://blocked.example/", redirectedFromHttp: true },
      securityHeaders: { hasHsts: true, hasCsp: false, hasClickjackingProtection: true },
    },
    failures: { page: "blocked", pagespeed: "blocked", sitemapRobots: "blocked", brokenLinks: "blocked" },
  },
};
