import type { CheckResults } from "./checkResults";

export type IssueCategory = "performance" | "seo" | "accessibility" | "security";
/**
 * critico: breaks the site for visitors or leaves it insecure (no HTTPS,
 *   unusable on phones, most links or images broken, very slow).
 * atencao: a real problem worth fixing, but the site still works.
 * sugestao: an improvement opportunity whose absence isn't a problem by
 *   itself (hardening headers, a sitemap). Suggestions never lower the
 *   score; see lib/score.ts.
 */
export type IssueSeverity = "critico" | "atencao" | "sugestao";

const SEVERITY_RANK: Record<IssueSeverity, number> = { critico: 0, atencao: 1, sugestao: 2 };

/**
 * Most important first: severity, then the order deriveIssues found
 * them in (Array.prototype.sort is stable). The single ordering both the
 * report and the next-step screen use, so "top issues" means the same
 * thing everywhere.
 */
export function prioritizeIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

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
  // The specific elements behind the finding (image addresses, broken
  // link URLs), when the check knows them. Shown as plain text, never as
  // links: they come from a third-party page.
  affected?: string[];
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
export function deriveIssues(input: Partial<CheckResults>): Issue[] {
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
    // Defense-in-depth hardening on an already-secure connection: worth
    // adding, but their absence isn't a vulnerability by itself.
    if (!input.securityHeaders.hasHsts) {
      issues.push({ category: "security", severity: "sugestao", code: "no-hsts" });
    }
    if (!input.securityHeaders.hasCsp) {
      issues.push({ category: "security", severity: "sugestao", code: "no-csp" });
    }
    if (!input.securityHeaders.hasClickjackingProtection) {
      issues.push({ category: "security", severity: "sugestao", code: "no-clickjacking-protection" });
    }
  }

  if (input.metaTags) {
    if (!input.metaTags.hasTitle) {
      issues.push({ category: "seo", severity: "critico", code: "no-title" });
    } else if (input.metaTags.title === "Home" || input.metaTags.title === "Início") {
      // The page still has a title and still ranks; it just doesn't sell
      // itself in results. Not in the same league as having none.
      issues.push({
        category: "seo",
        severity: "atencao",
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
  } else if (input.pagespeed) {
    // Our fetch of the page was refused or failed, but Lighthouse got
    // through: same findings from its audits. `=== false` throughout,
    // since undefined means the audit didn't run, not that it failed.
    // No generic-title check here: Lighthouse doesn't expose the title text.
    if (input.pagespeed.hasTitle === false) {
      issues.push({ category: "seo", severity: "critico", code: "no-title" });
    }
    if (input.pagespeed.hasDescription === false) {
      issues.push({ category: "seo", severity: "atencao", code: "no-description" });
    }
    if (input.pagespeed.hasViewport === false) {
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
      affected: input.altImages.missingAltSrcs,
    });
  } else if (!input.altImages && input.pagespeed?.imagesHaveAlt === false) {
    // Lighthouse says some images lack alt text but gives no count to
    // grade by, so no params and "atencao" rather than guessing "critico".
    issues.push({ category: "accessibility", severity: "atencao", code: "missing-alt" });
  }

  // Explicitly `=== false`, not a falsy check: hasSitemap is
  // boolean | null, and null means the probe never reached the host —
  // claiming "we couldn't find a sitemap" on that basis would be a
  // finding about a site we never actually looked at.
  // A suggestion: small sites with internal links get crawled fine
  // without one; it mostly speeds up discovery of new pages.
  if (input.sitemapRobots?.hasSitemap === false) {
    issues.push({ category: "seo", severity: "sugestao", code: "no-sitemap" });
  }

  if (input.brokenLinks && input.brokenLinks.brokenCount > 0) {
    const ratio = input.brokenLinks.brokenCount / input.brokenLinks.checkedCount;
    issues.push({
      category: "seo",
      severity: ratio > 0.5 ? "critico" : "atencao",
      code: "broken-links",
      params: { broken: input.brokenLinks.brokenCount, checked: input.brokenLinks.checkedCount },
      affected: input.brokenLinks.brokenUrls,
    });
  }

  if (input.pagespeed) {
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
      // Skipped heading levels make navigation by headings harder, but
      // the content stays reachable: a structural improvement.
      issues.push({ category: "accessibility", severity: "sugestao", code: "heading-order" });
    }

    if (input.pagespeed.hasFormLabelIssues) {
      issues.push({ category: "accessibility", severity: "atencao", code: "missing-form-labels" });
    }

    // The performance category already shows this number. As a finding
    // it only adds something when no specific one (load time, layout
    // shift, server response) explains it; otherwise it's a repeat.
    const performanceScore = input.pagespeed.scores.performance;
    const hasSpecificPerformanceFinding = issues.some((issue) => issue.category === "performance");
    if (!hasSpecificPerformanceFinding && typeof performanceScore === "number" && performanceScore < 80) {
      issues.push({
        category: "performance",
        severity: performanceScore < 50 ? "critico" : "atencao",
        code: "low-performance",
        params: { score: performanceScore },
      });
    }
  }

  return issues;
}
