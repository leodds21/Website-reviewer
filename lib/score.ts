import type { PageSpeedResult } from "./pagespeed";
import type { HttpsCheckResult } from "./checks/https";
import type { MetaTagsCheckResult } from "./checks/meta-tags";
import type { AltImagesCheckResult } from "./checks/alt-images";
import type { SitemapRobotsCheckResult } from "./checks/sitemap-robots";
import type { SecurityHeadersCheckResult } from "./checks/security-headers";

export type Severity = "critico" | "atencao" | "ok" | "indisponivel";

export type CategoryScore =
  | { score: number; severity: Exclude<Severity, "indisponivel"> }
  | { score: null; severity: "indisponivel" };

export type AggregatedScore = {
  overall: number;
  overallSeverity: Severity;
  performance: CategoryScore;
  seo: CategoryScore;
  accessibility: CategoryScore;
  security: CategoryScore;
};

export function severityFor(score: number): Exclude<Severity, "indisponivel"> {
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

// A pass/fail signal as a score component: present is 100, absent is
// 0, and "we couldn't determine it" contributes nothing at all rather
// than being scored as a failure.
function booleanSignal(value: boolean | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return value ? 100 : 0;
}

// Each present header is worth an equal third — there's no published
// weighting between HSTS/CSP/clickjacking protection to justify
// treating one as more important than the others.
function securityHeadersScore(result: SecurityHeadersCheckResult): number {
  const signals = [result.hasHsts, result.hasCsp, result.hasClickjackingProtection];
  return (signals.filter(Boolean).length / signals.length) * 100;
}

// A category with no available component at all (every check it draws
// on failed to run) is "indisponivel" — not a fabricated 0 or 100.
// Filters out only the components whose source check actually ran;
// this is also how a category degrades gracefully when *some* but not
// all of its sources are missing (e.g. seo still scores from
// pagespeed+sitemap alone if metaTags failed to fetch).
function categoryFrom(components: (number | null)[]): CategoryScore {
  const available = components.filter((value): value is number => value !== null);
  if (available.length === 0) return { score: null, severity: "indisponivel" };
  return categoryScore(average(available));
}

export type AggregateScoreInput = {
  pagespeed?: PageSpeedResult;
  https?: HttpsCheckResult;
  securityHeaders?: SecurityHeadersCheckResult;
  metaTags?: MetaTagsCheckResult;
  altImages?: AltImagesCheckResult;
  sitemapRobots?: SitemapRobotsCheckResult;
};

/**
 * Combines PageSpeed's Lighthouse categories with our own checks into
 * the four categories the report shows. Performance is Lighthouse's
 * number as-is (nothing of ours adds signal there); the others blend
 * Lighthouse with checks that Lighthouse doesn't run at all (sitemap,
 * robots.txt, our own alt-text sample).
 *
 * Every input is optional: a check that failed to run (e.g. every
 * fetch blocked by a broken TLS certificate) contributes nothing
 * rather than a fabricated 0 or 100, and a category with zero
 * contributing checks comes back "indisponivel" instead of a made-up
 * number. overall only ever averages the categories that do have a
 * real score — the caller (the API route) is responsible for not
 * calling this at all when literally every check failed, so overall
 * is never itself indisponivel in practice.
 */
export function aggregateScore(input: AggregateScoreInput): AggregatedScore {
  const performance = categoryFrom([input.pagespeed?.scores.performance ?? null]);

  const seo = categoryFrom([
    input.pagespeed?.scores.seo ?? null,
    input.metaTags ? (input.metaTags.hasTitle ? 100 : 0) : null,
    input.metaTags ? (input.metaTags.hasDescription ? 100 : 0) : null,
    // `?? null` rather than a truthiness check: hasSitemap/hasRobotsTxt
    // are boolean | null, and a null (we couldn't reach the host to
    // find out) has to stay out of the average instead of scoring 0
    // like a confirmed absence would.
    booleanSignal(input.sitemapRobots?.hasSitemap),
    // robots.txt matters for the same reason sitemap.xml does — it's
    // how crawlers are told what to do with the site.
    booleanSignal(input.sitemapRobots?.hasRobotsTxt),
  ]);

  const accessibility = categoryFrom([
    input.pagespeed?.scores.accessibility ?? null,
    input.metaTags ? (input.metaTags.hasViewport ? 100 : 0) : null,
    input.altImages ? altImagesScore(input.altImages) : null,
  ]);

  // Security has no meaning at all without the https check specifically
  // — best-practices alone isn't a security signal, it's a secondary
  // bump on top of a confirmed-secure connection. A failed https check
  // drives security straight to 0 regardless of best-practices
  // (everything else about a site is moot if it's not served securely);
  // a missing https check makes the whole category indisponivel, not a
  // guess based on best-practices alone.
  const security = !input.https
    ? categoryFrom([])
    : !input.https.passed
      ? categoryScore(0)
      : categoryFrom([
          100,
          input.pagespeed?.scores["best-practices"] ?? null,
          input.securityHeaders ? securityHeadersScore(input.securityHeaders) : null,
        ]);

  const categories = [performance, seo, accessibility, security];
  const overallCategory = categoryFrom(categories.map((category) => category.score));

  return {
    overall: overallCategory.score ?? 0,
    overallSeverity: overallCategory.severity,
    performance,
    seo,
    accessibility,
    security,
  };
}
