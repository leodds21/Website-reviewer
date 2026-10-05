import { describe, expect, it } from "vitest";
import { deriveIssues, prioritizeIssues, type Issue } from "./issues";

describe("deriveIssues", () => {
  it("falls back to Lighthouse's audits for the page basics when our own fetch of the page failed", () => {
    const issues = deriveIssues({
      pagespeed: {
        scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 },
        hasTitle: false,
        hasDescription: false,
        hasViewport: true,
        imagesHaveAlt: false,
      },
    });

    expect(issues.map((issue) => issue.code)).toEqual(["no-title", "no-description", "missing-alt"]);
    const missingAlt = issues.find((issue) => issue.code === "missing-alt");
    expect(missingAlt?.severity).toBe("atencao");
    expect(missingAlt?.params).toBeUndefined();
  });

  it("prefers our own HTML parse over Lighthouse when both ran", () => {
    const issues = deriveIssues({
      pagespeed: { scores: { seo: 90 }, hasTitle: false },
      metaTags: { hasViewport: true, hasTitle: true, title: "Papelaria Central", hasDescription: true, description: "Y" },
    });

    expect(issues.map((issue) => issue.code)).not.toContain("no-title");
  });

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

  it("flags invalid-certificate instead of no-https when the cert chain is broken", () => {
    const issues = deriveIssues({
      https: { passed: false, finalUrl: "https://x.com", redirectedFromHttp: false, certificateError: true },
    });

    expect(issues).toEqual([{ category: "security", severity: "critico", code: "invalid-certificate" }]);
    expect(issues.some((issue) => issue.code === "no-https")).toBe(false);
  });

  it("produces no issues at all when every check is missing (nothing ran)", () => {
    expect(deriveIssues({})).toEqual([]);
  });

  it("only derives issues from whatever checks actually ran", () => {
    // Simulates a site whose broken certificate took down every other
    // check too — only https succeeded, so only a security finding
    // should come out, not fabricated "no title"/"no alt text" issues
    // for checks that never got a chance to run.
    const issues = deriveIssues({
      https: { passed: false, finalUrl: "https://x.com", redirectedFromHttp: false, certificateError: true },
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].category).toBe("security");
  });
});

describe("deriveIssues — security headers", () => {
  it("doesn't fire when securityHeaders wasn't provided", () => {
    const issues = deriveIssues({
      https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
    });

    expect(issues).toEqual([]);
  });

  it("doesn't fire when https failed, even if securityHeaders is present", () => {
    // Headers off a plain-http (or cert-broken) connection aren't a
    // meaningful hardening signal — no-https/invalid-certificate is
    // already the one finding that matters there.
    const issues = deriveIssues({
      https: { passed: false, finalUrl: "http://x.com", redirectedFromHttp: false },
      securityHeaders: { hasHsts: false, hasCsp: false, hasClickjackingProtection: false },
    });

    expect(issues.some((issue) => issue.code === "no-hsts")).toBe(false);
    expect(issues.some((issue) => issue.code === "no-csp")).toBe(false);
    expect(issues.some((issue) => issue.code === "no-clickjacking-protection")).toBe(false);
  });

  it("lists all three as suggestions when every header is missing on an https site", () => {
    const issues = deriveIssues({
      https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
      securityHeaders: { hasHsts: false, hasCsp: false, hasClickjackingProtection: false },
    });

    expect(issues).toContainEqual({ category: "security", severity: "sugestao", code: "no-hsts" });
    expect(issues).toContainEqual({ category: "security", severity: "sugestao", code: "no-csp" });
    expect(issues).toContainEqual({ category: "security", severity: "sugestao", code: "no-clickjacking-protection" });
  });

  it("flags nothing when every header is present", () => {
    const issues = deriveIssues({
      https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
      securityHeaders: { hasHsts: true, hasCsp: true, hasClickjackingProtection: true },
    });

    expect(issues).toEqual([]);
  });
});

describe("deriveIssues — slow-load-impact", () => {
  const baseInput = {
    https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
    metaTags: { hasViewport: true, hasTitle: true, title: "X", hasDescription: true, description: "Y" },
    altImages: { sampledCount: 10, missingAltCount: 0, missingAltSrcs: [] },
    sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
  };

  it("doesn't fire when lcpSeconds is unavailable", () => {
    const issues = deriveIssues({
      ...baseInput,
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 } },
    });

    expect(issues.some((issue) => issue.code === "slow-load-impact")).toBe(false);
  });

  it("doesn't fire below the first verified bucket (3s)", () => {
    const issues = deriveIssues({
      ...baseInput,
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, lcpSeconds: 2.5 },
    });

    expect(issues.some((issue) => issue.code === "slow-load-impact")).toBe(false);
  });

  it("uses the 32% figure (atencao) between 3s and 5s", () => {
    const issues = deriveIssues({
      ...baseInput,
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, lcpSeconds: 4.0 },
    });

    expect(issues).toContainEqual({
      category: "performance",
      severity: "atencao",
      code: "slow-load-impact",
      params: { seconds: 4.0, bounceIncreasePercent: 32 },
    });
  });

  it("uses the 90% figure (critico) between 5s and 10s", () => {
    const issues = deriveIssues({
      ...baseInput,
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, lcpSeconds: 6.0 },
    });

    expect(issues).toContainEqual(
      expect.objectContaining({ code: "slow-load-impact", severity: "critico", params: { seconds: 6.0, bounceIncreasePercent: 90 } }),
    );
  });

  it("uses the 123% figure (critico) at 10s or beyond", () => {
    const issues = deriveIssues({
      ...baseInput,
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, lcpSeconds: 12.0 },
    });

    expect(issues).toContainEqual(
      expect.objectContaining({ code: "slow-load-impact", severity: "critico", params: { seconds: 12.0, bounceIncreasePercent: 123 } }),
    );
  });
});

describe("deriveIssues — layout-shift (CLS)", () => {
  const baseInput = {
    https: { passed: true, finalUrl: "https://x.com", redirectedFromHttp: false },
    metaTags: { hasViewport: true, hasTitle: true, title: "X", hasDescription: true, description: "Y" },
    altImages: { sampledCount: 10, missingAltCount: 0, missingAltSrcs: [] },
    sitemapRobots: { hasSitemap: true, hasRobotsTxt: true },
  };

  it("doesn't fire when clsValue is unavailable", () => {
    const issues = deriveIssues({
      ...baseInput,
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 } },
    });

    expect(issues.some((issue) => issue.code === "layout-shift")).toBe(false);
  });

  it("doesn't fire below Google's 0.1 'good' threshold", () => {
    const issues = deriveIssues({
      ...baseInput,
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, clsValue: 0.05 },
    });

    expect(issues.some((issue) => issue.code === "layout-shift")).toBe(false);
  });

  it("flags atencao between 0.1 and 0.25 ('needs improvement')", () => {
    const issues = deriveIssues({
      ...baseInput,
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, clsValue: 0.18 },
    });

    expect(issues).toContainEqual({ category: "performance", severity: "atencao", code: "layout-shift", params: { value: 0.18 } });
  });

  it("flags critico past 0.25 ('poor')", () => {
    const issues = deriveIssues({
      ...baseInput,
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, clsValue: 0.4 },
    });

    expect(issues).toContainEqual({ category: "performance", severity: "critico", code: "layout-shift", params: { value: 0.4 } });
  });
});

describe("deriveIssues — color-contrast", () => {
  it("doesn't fire when hasColorContrastIssues is undefined (audit not applicable)", () => {
    const issues = deriveIssues({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 } },
    });

    expect(issues.some((issue) => issue.code === "color-contrast")).toBe(false);
  });

  it("doesn't fire when hasColorContrastIssues is false", () => {
    const issues = deriveIssues({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, hasColorContrastIssues: false },
    });

    expect(issues.some((issue) => issue.code === "color-contrast")).toBe(false);
  });

  it("flags atencao when hasColorContrastIssues is true", () => {
    const issues = deriveIssues({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, hasColorContrastIssues: true },
    });

    expect(issues).toContainEqual({ category: "accessibility", severity: "atencao", code: "color-contrast" });
  });
});

describe("deriveIssues — slow-server-response (TTFB)", () => {
  it("doesn't fire when ttfbMs is unavailable", () => {
    const issues = deriveIssues({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 } },
    });

    expect(issues.some((issue) => issue.code === "slow-server-response")).toBe(false);
  });

  it("doesn't fire at or below the 800ms 'good' threshold", () => {
    const issues = deriveIssues({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, ttfbMs: 800 },
    });

    expect(issues.some((issue) => issue.code === "slow-server-response")).toBe(false);
  });

  it("flags atencao between 800ms and 1800ms ('needs improvement')", () => {
    const issues = deriveIssues({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, ttfbMs: 1200 },
    });

    expect(issues).toContainEqual({ category: "performance", severity: "atencao", code: "slow-server-response", params: { ms: 1200 } });
  });

  it("flags critico past 1800ms ('poor')", () => {
    const issues = deriveIssues({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, ttfbMs: 2500 },
    });

    expect(issues).toContainEqual({ category: "performance", severity: "critico", code: "slow-server-response", params: { ms: 2500 } });
  });
});

describe("deriveIssues — heading-order", () => {
  it("doesn't fire when hasHeadingOrderIssues is undefined (audit not applicable)", () => {
    const issues = deriveIssues({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 } },
    });

    expect(issues.some((issue) => issue.code === "heading-order")).toBe(false);
  });

  it("suggests fixing heading order when hasHeadingOrderIssues is true", () => {
    const issues = deriveIssues({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, hasHeadingOrderIssues: true },
    });

    expect(issues).toContainEqual({ category: "accessibility", severity: "sugestao", code: "heading-order" });
  });
});

describe("deriveIssues — missing-form-labels", () => {
  it("doesn't fire when hasFormLabelIssues is undefined (no forms on the page)", () => {
    const issues = deriveIssues({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 } },
    });

    expect(issues.some((issue) => issue.code === "missing-form-labels")).toBe(false);
  });

  it("flags atencao when hasFormLabelIssues is true", () => {
    const issues = deriveIssues({
      pagespeed: { scores: { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 }, hasFormLabelIssues: true },
    });

    expect(issues).toContainEqual({ category: "accessibility", severity: "atencao", code: "missing-form-labels" });
  });
});

describe("deriveIssues — broken-links", () => {
  it("doesn't fire when there are no broken links", () => {
    const issues = deriveIssues({
      brokenLinks: { checkedCount: 5, brokenCount: 0, brokenUrls: [] },
    });

    expect(issues.some((issue) => issue.code === "broken-links")).toBe(false);
  });

  it("flags atencao when at most half the checked links are broken", () => {
    const issues = deriveIssues({
      brokenLinks: { checkedCount: 4, brokenCount: 1, brokenUrls: ["https://x.com/a"] },
    });

    expect(issues).toContainEqual({
      category: "seo",
      severity: "atencao",
      code: "broken-links",
      params: { broken: 1, checked: 4 },
      affected: ["https://x.com/a"],
    });
  });

  it("flags critico when more than half the checked links are broken", () => {
    const issues = deriveIssues({
      brokenLinks: { checkedCount: 4, brokenCount: 3, brokenUrls: ["https://x.com/a", "https://x.com/b", "https://x.com/c"] },
    });

    expect(issues).toContainEqual({
      category: "seo",
      severity: "critico",
      code: "broken-links",
      params: { broken: 3, checked: 4 },
      affected: ["https://x.com/a", "https://x.com/b", "https://x.com/c"],
    });
  });
});

describe("deriveIssues — severity taxonomy", () => {
  it("treats a generic title as attention, not critical: the page still has one", () => {
    const issues = deriveIssues({
      metaTags: { hasViewport: true, hasTitle: true, title: "Home", hasDescription: true, description: "d" },
    });

    expect(issues).toContainEqual(expect.objectContaining({ code: "generic-title", severity: "atencao" }));
  });

  it("lists a missing sitemap as a suggestion", () => {
    const issues = deriveIssues({ sitemapRobots: { hasSitemap: false, hasRobotsTxt: true } });

    expect(issues).toEqual([{ category: "seo", severity: "sugestao", code: "no-sitemap" }]);
  });
});

describe("deriveIssues — performance consolidation", () => {
  const slowScores = { performance: 34, accessibility: 90, "best-practices": 90, seo: 90 };

  it("doesn't repeat the category score as a finding when a specific cause explains it", () => {
    const issues = deriveIssues({ pagespeed: { scores: slowScores, lcpSeconds: 6.2 } });

    expect(issues.map((issue) => issue.code)).toEqual(["slow-load-impact"]);
  });

  it("falls back to the score finding when nothing more specific was found", () => {
    const issues = deriveIssues({ pagespeed: { scores: slowScores, lcpSeconds: 1.8 } });

    expect(issues).toEqual([{ category: "performance", severity: "critico", code: "low-performance", params: { score: 34 } }]);
  });
});

describe("prioritizeIssues", () => {
  const issue = (code: Issue["code"], severity: Issue["severity"]): Issue => ({ category: "seo", severity, code });

  it("puts critical first, then attention, then suggestions, keeping the original order within each", () => {
    const ordered = prioritizeIssues([
      issue("no-sitemap", "sugestao"),
      issue("no-description", "atencao"),
      issue("no-title", "critico"),
      issue("generic-title", "atencao"),
    ]);

    expect(ordered.map((i) => i.code)).toEqual(["no-title", "no-description", "generic-title", "no-sitemap"]);
  });

  it("doesn't reorder the array it was given", () => {
    const original = [issue("no-sitemap", "sugestao"), issue("no-title", "critico")];

    prioritizeIssues(original);

    expect(original[0].code).toBe("no-sitemap");
  });
});

describe("deriveIssues — affected elements", () => {
  it("lists the images missing alt text, from our own page parse", () => {
    const issues = deriveIssues({
      altImages: { sampledCount: 3, missingAltCount: 2, missingAltSrcs: ["/hero.jpg", ""] },
    });

    expect(issues[0].affected).toEqual(["/hero.jpg", ""]);
  });

  it("has no list when the finding came from Lighthouse, which names no images", () => {
    const issues = deriveIssues({ pagespeed: { scores: { accessibility: 80 }, imagesHaveAlt: false } });

    expect(issues.find((issue) => issue.code === "missing-alt")?.affected).toBeUndefined();
  });
});
