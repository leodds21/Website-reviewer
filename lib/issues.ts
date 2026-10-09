import type { CheckResults } from "./checkResults";
import { issueScoreImpact, type AggregatedScore } from "./score";

export type IssueCategory = "performance" | "seo" | "accessibility" | "security";
/**
 * critico: breaks the site for visitors or leaves it insecure.
 * atencao: a real problem, but the site still works.
 * sugestao: optional improvement; never lowers the score.
 */
export type IssueSeverity = "critico" | "atencao" | "sugestao";

const SEVERITY_RANK: Record<IssueSeverity, number> = { critico: 0, atencao: 1, sugestao: 2 };

/** Severity first, then points of the overall score, then the order found. */
export function rankIssues(issues: Issue[], score: AggregatedScore): Issue[] {
  return issues
    .map((issue, order) => ({ issue, order, impact: issueScoreImpact(issue, score) }))
    .sort((a, b) => SEVERITY_RANK[a.issue.severity] - SEVERITY_RANK[b.issue.severity] || b.impact - a.impact || a.order - b.order)
    .map(({ issue }) => issue);
}

const TOP_ISSUES = 3;

// Suggestions never fill a slot, so there can be fewer than three.
export function topIssues(issues: Issue[], score: AggregatedScore): Issue[] {
  return rankIssues(issues, score)
    .filter((issue) => issue.severity !== "sugestao")
    .slice(0, TOP_ISSUES);
}

export type IssueCode =
  | "no-https"
  | "invalid-certificate"
  | "no-https-redirect"
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
  // Shown as plain text, never as links: they come from a third-party page.
  affected?: string[];
};

// Bounce increase vs a 1s load, from Google's Chrome UX Report study of
// mobile pages. Only these three points were measured, so no interpolation.
const LOAD_IMPACT_BUCKETS = [
  { minSeconds: 10, bounceIncreasePercent: 123 },
  { minSeconds: 5, bounceIncreasePercent: 90 },
  { minSeconds: 3, bounceIncreasePercent: 32 },
] as const;

// Core Web Vitals thresholds (web.dev/articles/cls, web.dev/articles/ttfb).
const CLS_NEEDS_IMPROVEMENT_THRESHOLD = 0.1;
const CLS_POOR_THRESHOLD = 0.25;

const TTFB_NEEDS_IMPROVEMENT_THRESHOLD_MS = 800;
const TTFB_POOR_THRESHOLD_MS = 1800;

/**
 * Findings as code + params, so the UI can render them in any language.
 * A check that failed adds nothing rather than a false negative.
 */
export function deriveIssues(input: Partial<CheckResults>): Issue[] {
  const issues: Issue[] = [];

  if (input.https) {
    if (input.https.certificateError) {
      issues.push({ category: "security", severity: "critico", code: "invalid-certificate" });
    } else if (!input.https.passed) {
      issues.push({ category: "security", severity: "critico", code: "no-https" });
    } else if (input.https.noHttpRedirect) {
      issues.push({ category: "security", severity: "atencao", code: "no-https-redirect" });
    }
  }

  // Hardening headers only matter once HTTPS works; otherwise they'd bury that finding.
  if (input.https?.passed && input.securityHeaders) {
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
    // Our fetch failed but Lighthouse got through. undefined means the
    // audit didn't run, hence `=== false`.
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
    // Lighthouse gives no count to grade by.
    issues.push({ category: "accessibility", severity: "atencao", code: "missing-alt" });
  }

  // null means the host was never reached, not that the sitemap is missing.
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
      // Pass/fail for the whole page, so no ratio to grade by.
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
      issues.push({ category: "accessibility", severity: "sugestao", code: "heading-order" });
    }

    if (input.pagespeed.hasFormLabelIssues) {
      issues.push({ category: "accessibility", severity: "atencao", code: "missing-form-labels" });
    }

    // Only when no specific performance finding already explains the score.
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
