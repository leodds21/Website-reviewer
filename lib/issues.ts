import type { PageSpeedResult } from "./pagespeed";
import type { HttpsCheckResult } from "./checks/https";
import type { MetaTagsCheckResult } from "./checks/metaTags";
import type { AltImagesCheckResult } from "./checks/altImages";
import type { SitemapRobotsCheckResult } from "./checks/sitemapRobots";
import type { SecurityHeadersCheckResult } from "./checks/securityHeaders";
import type { BrokenLinksCheckResult } from "./checks/brokenLinks";

export type IssueCategory = "performance" | "seo" | "accessibility" | "security";
export type IssueSeverity = "critico" | "atencao";

export type IssueCode =
  | "no-https"
  | "invalid-certificate"
  | "no-hsts"
  | "no-csp"
  | "no-clickjacking-protection"
  | "no-title"
  | "generic-title"
  | "no-description"
  | "no-viewport"
  | "missing-alt"
  | "no-sitemap"
  | "low-performance"
  | "slow-load-impact"
  | "layout-shift"
  | "color-contrast"
  | "slow-server-response"
  | "heading-order"
  | "missing-form-labels"
  | "broken-links";

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

// Google's own published Core Web Vitals thresholds for Cumulative
// Layout Shift (web.dev/articles/cls): "good" is below 0.1, "poor" is
// above 0.25. Values in between ("needs improvement") land as
// "atencao" here; anything past 0.25 is "critico".
const CLS_NEEDS_IMPROVEMENT_THRESHOLD = 0.1;
const CLS_POOR_THRESHOLD = 0.25;

// Google's own published Core Web Vitals thresholds for Time to First
// Byte (web.dev/articles/ttfb): "good" is at or below 800ms, "poor" is
// past 1800ms. This is the server's own response time, before the
// browser has any HTML — distinct from LCP, which also counts
// everything the browser does after the first byte arrives.
const TTFB_NEEDS_IMPROVEMENT_THRESHOLD_MS = 800;
const TTFB_POOR_THRESHOLD_MS = 1800;

export type DeriveIssuesInput = {
  pagespeed?: PageSpeedResult;
  https?: HttpsCheckResult;
  securityHeaders?: SecurityHeadersCheckResult;
  metaTags?: MetaTagsCheckResult;
  altImages?: AltImagesCheckResult;
  sitemapRobots?: SitemapRobotsCheckResult;
  brokenLinks?: BrokenLinksCheckResult;
};

/**
 * Turns the raw check/PageSpeed results into findings for the "o que
 * encontramos" list — as a code + params, not display text, so the UI
 * can render the same finding in any language without re-running the
 * analysis. Kept separate from the checks themselves so each check
 * module stays a pure data source; severity thresholds (e.g. alt-image
 * ratio, performance score cutoffs) live here instead of scattered
 * across checks.
 *
 * Every input is optional: a check that failed to run (network error,
 * broken certificate blocking every fetch, etc) contributes no issues
 * rather than a false "everything is missing" one — silence, not a
 * fabricated negative, is the honest response to missing data.
 */
export function deriveIssues(input: DeriveIssuesInput): Issue[] {
  const issues: Issue[] = [];

  if (input.https) {
    if (input.https.certificateError) {
      issues.push({ category: "security", severity: "critico", code: "invalid-certificate" });
    } else if (!input.https.passed) {
      issues.push({ category: "security", severity: "critico", code: "no-https" });
    }
  }

  // Header hardening only means anything once the connection itself is
  // trustworthy — flagging a missing CSP on a site that isn't even
  // serving HTTPS would bury the one finding that actually matters.
  if (input.https?.passed && input.securityHeaders) {
    if (!input.securityHeaders.hasHsts) {
      issues.push({ category: "security", severity: "atencao", code: "no-hsts" });
    }
    if (!input.securityHeaders.hasCsp) {
      issues.push({ category: "security", severity: "atencao", code: "no-csp" });
    }
    if (!input.securityHeaders.hasClickjackingProtection) {
      issues.push({ category: "security", severity: "atencao", code: "no-clickjacking-protection" });
    }
  }

  if (input.metaTags) {
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
  }

  if (input.altImages && input.altImages.missingAltCount > 0) {
    const ratio = input.altImages.missingAltCount / input.altImages.sampledCount;
    issues.push({
      category: "accessibility",
      severity: ratio > 0.5 ? "critico" : "atencao",
      code: "missing-alt",
      params: { missing: input.altImages.missingAltCount, sampled: input.altImages.sampledCount },
    });
  }

  // Explicitly `=== false`, not a falsy check: hasSitemap is
  // boolean | null, and null means the probe never reached the host —
  // claiming "we couldn't find a sitemap" on that basis would be a
  // finding about a site we never actually looked at.
  if (input.sitemapRobots?.hasSitemap === false) {
    issues.push({ category: "seo", severity: "atencao", code: "no-sitemap" });
  }

  if (input.brokenLinks && input.brokenLinks.brokenCount > 0) {
    const ratio = input.brokenLinks.brokenCount / input.brokenLinks.checkedCount;
    issues.push({
      category: "seo",
      severity: ratio > 0.5 ? "critico" : "atencao",
      code: "broken-links",
      params: { broken: input.brokenLinks.brokenCount, checked: input.brokenLinks.checkedCount },
    });
  }

  if (input.pagespeed) {
    const performanceScore = input.pagespeed.scores.performance;
    if (typeof performanceScore === "number" && performanceScore < 80) {
      issues.push({
        category: "performance",
        severity: performanceScore < 50 ? "critico" : "atencao",
        code: "low-performance",
        params: { score: performanceScore },
      });
    }

    if (typeof input.pagespeed.lcpSeconds === "number") {
      const lcpSeconds = input.pagespeed.lcpSeconds;
      const bucket = LOAD_IMPACT_BUCKETS.find((b) => lcpSeconds >= b.minSeconds);
      if (bucket) {
        issues.push({
          category: "performance",
          severity: bucket.minSeconds >= 5 ? "critico" : "atencao",
          code: "slow-load-impact",
          params: { seconds: lcpSeconds, bounceIncreasePercent: bucket.bounceIncreasePercent },
        });
      }
    }

    if (typeof input.pagespeed.clsValue === "number" && input.pagespeed.clsValue > CLS_NEEDS_IMPROVEMENT_THRESHOLD) {
      issues.push({
        category: "performance",
        severity: input.pagespeed.clsValue > CLS_POOR_THRESHOLD ? "critico" : "atencao",
        code: "layout-shift",
        params: { value: input.pagespeed.clsValue },
      });
    }

    if (input.pagespeed.hasColorContrastIssues) {
      // Lighthouse's audit is pass/fail for the whole page, with no
      // count or ratio of affected elements exposed here — unlike
      // missing-alt, there's no proportional signal to grade severity
      // by, so this stays "atencao" rather than guessing at "critico".
      issues.push({ category: "accessibility", severity: "atencao", code: "color-contrast" });
    }

    if (typeof input.pagespeed.ttfbMs === "number" && input.pagespeed.ttfbMs > TTFB_NEEDS_IMPROVEMENT_THRESHOLD_MS) {
      issues.push({
        category: "performance",
        severity: input.pagespeed.ttfbMs > TTFB_POOR_THRESHOLD_MS ? "critico" : "atencao",
        code: "slow-server-response",
        params: { ms: input.pagespeed.ttfbMs },
      });
    }

    if (input.pagespeed.hasHeadingOrderIssues) {
      // Same pass/fail shape as color-contrast: Lighthouse gives no
      // count of affected headings, so this stays "atencao".
      issues.push({ category: "accessibility", severity: "atencao", code: "heading-order" });
    }

    if (input.pagespeed.hasFormLabelIssues) {
      issues.push({ category: "accessibility", severity: "atencao", code: "missing-form-labels" });
    }
  }

  return issues;
}
