import type { PageSpeedResult } from "./pagespeed";
import type { HttpsCheckResult } from "./checks/https";
import type { MetaTagsCheckResult } from "./checks/meta-tags";
import type { AltImagesCheckResult } from "./checks/alt-images";
import type { SitemapRobotsCheckResult } from "./checks/sitemap-robots";

export type IssueCategory = "performance" | "seo" | "accessibility" | "security";
export type IssueSeverity = "critico" | "atencao";

export type IssueCode =
  | "no-https"
  | "no-title"
  | "generic-title"
  | "no-description"
  | "no-viewport"
  | "missing-alt"
  | "no-sitemap"
  | "low-performance"
  | "slow-load-impact";

export type Issue = {
  category: IssueCategory;
  severity: IssueSeverity;
  code: IssueCode;
  params?: Record<string, string | number>;
};

// Bounce-probability increase by load time, relative to a 1s load.
// Source: Google's analysis of Chrome UX Report data across ~900k
// mobile landing pages (the research behind the "Think with Google"
// mobile speed benchmarks). Only three points are verified — 1s→3s,
// 1s→5s, 1s→10s — so each bucket reports the verified figure for the
// threshold it has crossed, as a floor ("pelo menos"/"at least"),
// instead of interpolating a number nobody measured.
const LOAD_IMPACT_BUCKETS = [
  { minSeconds: 10, bounceIncreasePercent: 123 },
  { minSeconds: 5, bounceIncreasePercent: 90 },
  { minSeconds: 3, bounceIncreasePercent: 32 },
] as const;

/**
 * Turns the raw check/PageSpeed results into findings for the "o que
 * encontramos" list — as a code + params, not display text, so the UI
 * can render the same finding in any language without re-running the
 * analysis. Kept separate from the checks themselves so each check
 * module stays a pure data source; severity thresholds (e.g. alt-image
 * ratio, performance score cutoffs) live here instead of scattered
 * across checks.
 */
export function deriveIssues(input: {
  pagespeed: PageSpeedResult;
  https: HttpsCheckResult;
  metaTags: MetaTagsCheckResult;
  altImages: AltImagesCheckResult;
  sitemapRobots: SitemapRobotsCheckResult;
}): Issue[] {
  const issues: Issue[] = [];

  if (!input.https.passed) {
    issues.push({ category: "security", severity: "critico", code: "no-https" });
  }

  if (!input.metaTags.hasTitle) {
    issues.push({ category: "seo", severity: "critico", code: "no-title" });
  } else if (input.metaTags.title === "Home" || input.metaTags.title === "Início") {
    issues.push({
      category: "seo",
      severity: "critico",
      code: "generic-title",
      params: { title: input.metaTags.title },
    });
  }

  if (!input.metaTags.hasDescription) {
    issues.push({ category: "seo", severity: "atencao", code: "no-description" });
  }

  if (!input.metaTags.hasViewport) {
    issues.push({ category: "accessibility", severity: "critico", code: "no-viewport" });
  }

  if (input.altImages.missingAltCount > 0) {
    const ratio = input.altImages.missingAltCount / input.altImages.sampledCount;
    issues.push({
      category: "accessibility",
      severity: ratio > 0.5 ? "critico" : "atencao",
      code: "missing-alt",
      params: { missing: input.altImages.missingAltCount, sampled: input.altImages.sampledCount },
    });
  }

  if (!input.sitemapRobots.hasSitemap) {
    issues.push({ category: "seo", severity: "atencao", code: "no-sitemap" });
  }

  if (input.pagespeed.scores.performance < 80) {
    issues.push({
      category: "performance",
      severity: input.pagespeed.scores.performance < 50 ? "critico" : "atencao",
      code: "low-performance",
      params: { score: input.pagespeed.scores.performance },
    });
  }

  if (typeof input.pagespeed.lcpSeconds === "number") {
    const bucket = LOAD_IMPACT_BUCKETS.find((b) => input.pagespeed.lcpSeconds! >= b.minSeconds);
    if (bucket) {
      issues.push({
        category: "performance",
        severity: bucket.minSeconds >= 5 ? "critico" : "atencao",
        code: "slow-load-impact",
        params: { seconds: input.pagespeed.lcpSeconds, bounceIncreasePercent: bucket.bounceIncreasePercent },
      });
    }
  }

  return issues;
}
