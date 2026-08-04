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
  | "low-performance";

export type Issue = {
  category: IssueCategory;
  severity: IssueSeverity;
  code: IssueCode;
  params?: Record<string, string | number>;
};

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

  return issues;
}
