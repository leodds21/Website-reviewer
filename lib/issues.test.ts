import { describe, expect, it } from "vitest";
import { deriveIssues } from "./issues";

describe("deriveIssues", () => {
  it("generates no issues for a site that passes every check", () => {
    const cleanSite = deriveIssues({
      pagespeed: { scores: { performance: 95, accessibility: 95, "best-practices": 92, seo: 90 } },
      https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
      metaTags: { hasViewport: true, hasTitle: true, title: "Papelaria Central", hasDescription: true, description: "Y" },
      altImages: { sampledCount: 10, missingAltCount: 0, missingAltSrcs: [] },
      sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
    });

    expect(cleanSite).toEqual([]);
  });

  it("flags every real problem on a site that fails most checks", () => {
    const messySite = deriveIssues({
      pagespeed: { scores: { performance: 41, accessibility: 67, "best-practices": 80, seo: 58 } },
      https: { passed: false, finalUrl: "http://x.com", redirectedFromHttp: false },
      metaTags: { hasViewport: false, hasTitle: true, title: "Home", hasDescription: false, description: null },
      altImages: { sampledCount: 12, missingAltCount: 8, missingAltSrcs: [] },
      sitemapRobots: { hasSitemap: false, hasRobotsTxt: true },
    });

    expect(messySite).toContainEqual({ category: "security", severity: "critico", code: "no-https" });
    expect(messySite).toContainEqual(
      expect.objectContaining({ code: "generic-title", params: { title: "Home" } }),
    );
    expect(messySite).toContainEqual(
      expect.objectContaining({ code: "missing-alt", params: { missing: 8, sampled: 12 } }),
    );
    expect(messySite.filter((issue) => issue.severity === "critico").length).toBeGreaterThanOrEqual(3);
  });
});
