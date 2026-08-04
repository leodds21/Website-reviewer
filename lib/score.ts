import type { PageSpeedResult } from "./pagespeed";
import type { HttpsCheckResult } from "./checks/https";
import type { MetaTagsCheckResult } from "./checks/meta-tags";
import type { AltImagesCheckResult } from "./checks/alt-images";
import type { SitemapRobotsCheckResult } from "./checks/sitemap-robots";

export type Severity = "critico" | "atencao" | "ok";

export type CategoryScore = { score: number; severity: Severity };

export type AggregatedScore = {
  overall: number;
  overallSeverity: Severity;
  performance: CategoryScore;
  seo: CategoryScore;
  accessibility: CategoryScore;
  security: CategoryScore;
};

export function severityFor(score: number): Severity {
  if (score < 50) return "critico";
  if (score < 80) return "atencao";
  return "ok";
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function altImagesScore(result: AltImagesCheckResult): number {
  if (result.sampledCount === 0) return 100;
  return ((result.sampledCount - result.missingAltCount) / result.sampledCount) * 100;
}

function categoryScore(score: number): CategoryScore {
  const rounded = Math.round(score);
  return { score: rounded, severity: severityFor(rounded) };
}

/**
 * Combines PageSpeed's Lighthouse categories with our own checks into
 * the four categories the report shows. Performance is Lighthouse's
 * number as-is (nothing of ours adds signal there); the others blend
 * Lighthouse with checks that Lighthouse doesn't run at all (sitemap,
 * robots.txt, our own alt-text sample). Security has no PageSpeed
 * signal, so a failed HTTPS check alone drives it to 0 — everything
 * else about a site is moot if it's not even served securely.
 */
export function aggregateScore(input: {
  pagespeed: PageSpeedResult;
  https: HttpsCheckResult;
  metaTags: MetaTagsCheckResult;
  altImages: AltImagesCheckResult;
  sitemapRobots: SitemapRobotsCheckResult;
}): AggregatedScore {
  const performance = input.pagespeed.scores.performance;

  const seo = average([
    input.pagespeed.scores.seo,
    input.metaTags.hasTitle ? 100 : 0,
    input.metaTags.hasDescription ? 100 : 0,
    input.sitemapRobots.hasSitemap ? 100 : 0,
  ]);

  const accessibility = average([
    input.pagespeed.scores.accessibility,
    input.metaTags.hasViewport ? 100 : 0,
    altImagesScore(input.altImages),
  ]);

  const security = input.https.passed
    ? average([100, input.pagespeed.scores["best-practices"]])
    : 0;

  const overall = average([performance, seo, accessibility, security]);

  return {
    overall: Math.round(overall),
    overallSeverity: severityFor(overall),
    performance: categoryScore(performance),
    seo: categoryScore(seo),
    accessibility: categoryScore(accessibility),
    security: categoryScore(security),
  };
}
