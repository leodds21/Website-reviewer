import { describe, expect, it } from "vitest";
import { deriveIssues, rankIssues, topIssues, type Issue } from "./issues";
import { COMPONENT_ISSUES, aggregateScore, issueScoreImpact, type ScoreComponentKey } from "./score";
import { SCORE_SCENARIOS } from "./scoreScenarios";

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
      sitemapRobots: { hasSitemap: true, hasRobotsTxt: true, blocksGooglebot: null, hasFaviconIco: null },
    });

    expect(cleanSite).toEqual([]);
  });

  it("flags every real problem on a site that fails most checks", () => {
    const messySite = deriveIssues({
      pagespeed: { scores: { performance: 41, accessibility: 67, "best-practices": 80, seo: 58 } },
      https: { passed: false, finalUrl: "http://x.com", redirectedFromHttp: false },
      metaTags: { hasViewport: false, hasTitle: true, title: "Home", hasDescription: false, description: null },
      altImages: { sampledCount: 12, missingAltCount: 8, missingAltSrcs: [] },
      sitemapRobots: { hasSitemap: false, hasRobotsTxt: true, blocksGooglebot: null, hasFaviconIco: null },
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

  it("flags a missing http redirect as attention, not the critical no-https", () => {
    const issues = deriveIssues({
      https: { passed: true, finalUrl: "https://x.com/", redirectedFromHttp: false, noHttpRedirect: true },
    });

    expect(issues).toEqual([{ category: "security", severity: "atencao", code: "no-https-redirect" }]);
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
    // Only https ran, so only a security finding comes out.
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
    sitemapRobots: { hasSitemap: true, hasRobotsTxt: true, blocksGooglebot: null, hasFaviconIco: null },
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
    sitemapRobots: { hasSitemap: true, hasRobotsTxt: true, blocksGooglebot: null, hasFaviconIco: null },
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
    const issues = deriveIssues({ sitemapRobots: { hasSitemap: false, hasRobotsTxt: true, blocksGooglebot: null, hasFaviconIco: null } });

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

describe("rankIssues and topIssues", () => {
  const issue = (code: Issue["code"], severity: Issue["severity"], category: Issue["category"] = "seo"): Issue => ({ category, severity, code });
  // A score with nothing measured: every finding's impact is 0, so the
  // order falls back to severity and then the original order.
  const noScore = aggregateScore({});

  it("has nothing to rank when there are no findings", () => {
    expect(rankIssues([], noScore)).toEqual([]);
    expect(topIssues([], noScore)).toEqual([]);
  });

  it("returns one or two entries when that's all there is, never padding to three", () => {
    expect(topIssues([issue("no-title", "critico")], noScore).map((i) => i.code)).toEqual(["no-title"]);
    expect(topIssues([issue("no-title", "critico"), issue("no-description", "atencao")], noScore)).toHaveLength(2);
  });

  it("keeps three when there are more, across categories", () => {
    const issues = [
      issue("no-description", "atencao"),
      issue("no-https", "critico", "security"),
      issue("color-contrast", "atencao", "accessibility"),
      issue("slow-load-impact", "critico", "performance"),
      issue("broken-links", "atencao"),
    ];
    expect(topIssues(issues, noScore).map((i) => i.code)).toEqual(["no-https", "slow-load-impact", "no-description"]);
  });

  it("never lets a suggestion fill a slot, and leaves only suggestions out entirely", () => {
    expect(topIssues([issue("no-sitemap", "sugestao"), issue("no-csp", "sugestao", "security")], noScore)).toEqual([]);
    expect(topIssues([issue("no-sitemap", "sugestao"), issue("no-description", "atencao")], noScore).map((i) => i.code)).toEqual([
      "no-description",
    ]);
  });

  it("puts a critical finding above an attention one even when the attention one costs more points", () => {
    // The missing description costs 25 points, more than any critical one here.
    const { input } = SCORE_SCENARIOS.average;
    const score = aggregateScore(input);
    const ranked = rankIssues([issue("no-description", "atencao"), issue("no-viewport", "critico", "accessibility")], score);
    expect(ranked.map((i) => i.code)).toEqual(["no-viewport", "no-description"]);
  });

  it("breaks a tie in severity by the points each finding costs", () => {
    const { input } = SCORE_SCENARIOS.average;
    const score = aggregateScore(input);
    const issues = deriveIssues(input);
    // Points lost: load 29, redirect 25 and description 25 (tie, so
    // derivation order), alt 8, links 6, contrast 4, generic title 0.
    expect(rankIssues(issues, score).filter((i) => i.severity === "atencao").map((i) => i.code)).toEqual([
      "slow-load-impact",
      "no-https-redirect",
      "no-description",
      "missing-alt",
      "broken-links",
      "color-contrast",
      "generic-title",
    ]);
  });

  it("keeps the original order on a full tie, every time", () => {
    const issues = [issue("generic-title", "atencao"), issue("heading-order", "atencao", "accessibility")];
    expect(rankIssues(issues, noScore).map((i) => i.code)).toEqual(["generic-title", "heading-order"]);
    expect(rankIssues(issues, noScore)).toEqual(rankIssues(issues, noScore));
  });

  it("ignores a measurement from a newer server that this bundle doesn't know", () => {
    const score = aggregateScore(SCORE_SCENARIOS.average.input);
    const issues = deriveIssues(SCORE_SCENARIOS.average.input);
    const seo = score.seo;
    if (seo.score === null) throw new Error("expected a scored SEO category");
    const unknown = { key: "future-check" as ScoreComponentKey, value: 0, lost: 40 };
    const newer = { ...score, seo: { ...seo, components: [unknown, ...seo.components] } };

    expect(rankIssues(issues, newer)).toEqual(rankIssues(issues, score));
  });

  it("doesn't reorder the array it was given", () => {
    const original = [issue("no-sitemap", "sugestao"), issue("no-title", "critico")];
    rankIssues(original, noScore);
    expect(original[0].code).toBe("no-sitemap");
  });
});

// The score explanation and "Corrija primeiro" must use the same findings.
describe("score explanation and top issues stay coherent", () => {
  for (const name of ["average", "bad"] as const) {
    it(`draws the ${name} site's top issues from the report's own findings and measurements`, () => {
      const { input, failures } = SCORE_SCENARIOS[name];
      const score = aggregateScore(input, failures);
      const issues = deriveIssues(input);
      const top = topIssues(issues, score);

      expect(top.length).toBeGreaterThan(0);
      for (const entry of top) {
        // The very same finding object the report lists, not a copy.
        expect(issues).toContain(entry);
        // Its impact is exactly its measurement's share of the overall score.
        const category = score[entry.category];
        const component = category.score === null ? undefined : category.components?.find((c) => COMPONENT_ISSUES[c.key].includes(entry.code));
        const scored = [score.performance, score.seo, score.accessibility, score.security].filter((c) => c.score !== null).length;
        expect(issueScoreImpact(entry, score)).toBe(component ? component.lost / scored : 0);
      }
    });
  }

  it("puts the bad site's missing HTTPS first, the finding that zeroes security", () => {
    const { input } = SCORE_SCENARIOS.bad;
    const top = topIssues(deriveIssues(input), aggregateScore(input));
    expect(top[0].code).toBe("no-https");
    expect(top.every((entry) => entry.severity === "critico")).toBe(true);
  });

  it("never turns a check that couldn't run into a top issue", () => {
    const { input, failures } = SCORE_SCENARIOS.blocked;
    const issues = deriveIssues(input);
    // Blocked page, PageSpeed, sitemap and links are failures, not findings.
    expect(issues.every((entry) => entry.severity === "sugestao")).toBe(true);
    expect(topIssues(issues, aggregateScore(input, failures))).toEqual([]);
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

describe("deriveIssues, page signals", () => {
  const codes = (input: Parameters<typeof deriveIssues>[0]) => deriveIssues(input).map((issue) => issue.code);
  const https = { passed: true, finalUrl: "https://x.com/", redirectedFromHttp: true };
  const robots = { hasSitemap: true, hasRobotsTxt: true, blocksGooglebot: false, hasFaviconIco: true };

  it("flags noindex as critical, saying where it came from", () => {
    const [meta] = deriveIssues({ indexing: { metaNoindex: true, headerNoindex: true } });
    expect(meta).toMatchObject({ code: "noindex", severity: "critico", category: "seo", params: { source: "meta" } });
    expect(deriveIssues({ indexing: { metaNoindex: false, headerNoindex: true } })[0].params).toEqual({ source: "header" });
  });

  it("flags a robots.txt block as critical", () => {
    expect(deriveIssues({ sitemapRobots: { ...robots, blocksGooglebot: true } })).toEqual([{ category: "seo", severity: "critico", code: "robots-blocked" }]);
  });

  it("falls back to Lighthouse for noindex only when robots.txt doesn't already explain it", () => {
    expect(codes({ pagespeed: { scores: {}, isCrawlable: false } })).toEqual(["noindex"]);
    expect(codes({ pagespeed: { scores: {}, isCrawlable: false }, sitemapRobots: { ...robots, blocksGooglebot: true } })).toEqual(["robots-blocked"]);
    expect(codes({ indexing: { metaNoindex: false, headerNoindex: false }, pagespeed: { scores: {}, isCrawlable: false } })).toEqual([]);
  });

  it("suggests the social preview tags that are missing", () => {
    const [issue] = deriveIssues({ socialPreview: { missing: ["og:image"] } });
    expect(issue).toEqual({ category: "seo", severity: "sugestao", code: "no-social-preview", affected: ["og:image"] });
  });

  it("suggests structured data and a favicon only when they're confirmed missing", () => {
    expect(codes({ structuredData: { hasStructuredData: false } })).toEqual(["no-structured-data"]);
    expect(codes({ favicon: { hasIconLink: false }, sitemapRobots: { ...robots, hasFaviconIco: false } })).toEqual(["no-favicon"]);
    expect(codes({ favicon: { hasIconLink: false }, sitemapRobots: { ...robots, hasFaviconIco: null } })).toEqual([]);
  });

  it("flags a missing page language for accessibility, from our parse or Lighthouse's", () => {
    expect(deriveIssues({ htmlLang: { lang: null } })[0]).toMatchObject({ code: "no-html-lang", severity: "atencao", category: "accessibility" });
    expect(codes({ pagespeed: { scores: {}, hasHtmlLang: false } })).toEqual(["no-html-lang"]);
    expect(codes({ htmlLang: { lang: "en" }, pagespeed: { scores: {}, hasHtmlLang: false } })).toEqual([]);
  });

  it("flags mixed content with its count and sample, only over working HTTPS", () => {
    const mixedContent = { resourceCount: 5, insecureCount: 3, insecureUrls: ["http://a.example/x.png"] };
    expect(deriveIssues({ https, mixedContent })[0]).toMatchObject({
      code: "mixed-content",
      severity: "atencao",
      category: "security",
      params: { count: 3 },
      affected: ["http://a.example/x.png"],
    });
    expect(codes({ mixedContent })).toEqual([]);
    expect(codes({ https, pagespeed: { scores: {}, hasInsecureRequests: true } })).toEqual(["mixed-content"]);
    expect(codes({ https: { ...https, passed: false }, pagespeed: { scores: {}, hasInsecureRequests: true } })).not.toContain("mixed-content");
  });
});
