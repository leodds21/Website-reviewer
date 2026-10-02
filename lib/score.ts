import type { AltImagesCheckResult } from "./checks/altImages";
import type { BrokenLinksCheckResult } from "./checks/brokenLinks";
import type { CheckResults } from "./checkResults";
import type { SecurityHeadersCheckResult } from "./checks/securityHeaders";
import { primaryReason, type CheckFailures, type CheckKey, type FailureReason } from "./checkFailure";

export type Severity = "critico" | "atencao" | "ok" | "indisponivel";

// A category always carries an answer: a score (flagged partial when
// some of its sources failed, so the UI can say "medido em parte"), or
// the reason it couldn't be measured at all, so the UI never has to
// show a bare "não avaliado".
export type CategoryScore =
  | { score: number; severity: Exclude<Severity, "indisponivel">; partial: boolean }
  | { score: null; severity: "indisponivel"; reason: FailureReason };

export type AggregatedScore = {
  overall: number;
  overallSeverity: Severity;
  performance: CategoryScore;
  seo: CategoryScore;
  accessibility: CategoryScore;
  security: CategoryScore;
};

function severityFor(score: number): Exclude<Severity, "indisponivel"> {
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

// Zero checked links (no <a href> on the page at all) scores as clean,
// same reasoning as altImagesScore above — nothing was found broken
// because there was nothing to break. checkBrokenLinks itself throws
// rather than returning checkedCount: 0 when links existed but none
// could be verified (see lib/checks/brokenLinks.ts), so that ambiguous
// case never reaches this function as a fabricated 100.
function brokenLinksScore(result: BrokenLinksCheckResult): number {
  if (result.checkedCount === 0) return 100;
  return ((result.checkedCount - result.brokenCount) / result.checkedCount) * 100;
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

// Averages only the components whose source check actually ran; null
// when none did. This is how a category degrades gracefully when *some*
// but not all of its sources are missing (e.g. seo still scores from
// pagespeed+sitemap alone if metaTags failed to fetch).
function averageOf(components: (number | null)[]): number | null {
  const available = components.filter((value): value is number => value !== null);
  return available.length === 0 ? null : average(available);
}

// Which checks each category draws on — what "partial" and the
// unavailable reason are computed from.
const CATEGORY_SOURCES = {
  performance: ["pagespeed"],
  seo: ["pagespeed", "page", "sitemapRobots", "brokenLinks"],
  accessibility: ["pagespeed", "page"],
  security: ["https", "pagespeed"],
} satisfies Record<string, CheckKey[]>;

// A category with no available component at all is "indisponivel",
// never a fabricated 0 or 100, and says why. With no recorded failure
// among its sources, the checks ran but didn't yield this number
// (Lighthouse can skip a single category), hence "measurement-failed".
function finalize(score: number | null, sources: CheckKey[], failures: CheckFailures): CategoryScore {
  const reasons = sources.map((key) => failures[key]);
  if (score === null) {
    return { score: null, severity: "indisponivel", reason: primaryReason(reasons) ?? "measurement-failed" };
  }
  const rounded = Math.round(score);
  return { score: rounded, severity: severityFor(rounded), partial: reasons.some(Boolean) };
}

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
export function aggregateScore(input: Partial<CheckResults>, failures: CheckFailures = {}): AggregatedScore {
  const performance = finalize(input.pagespeed?.scores.performance ?? null, CATEGORY_SOURCES.performance, failures);

  const seo = averageOf([
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
    input.brokenLinks ? brokenLinksScore(input.brokenLinks) : null,
  ]);

  const accessibility = averageOf([
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
  // guess based on best-practices alone. A failed https check is a
  // complete answer on its own, so nothing else missing makes it partial.
  const security = !input.https
    ? finalize(null, CATEGORY_SOURCES.security, failures)
    : !input.https.passed
      ? finalize(0, [], failures)
      : finalize(
          averageOf([
            100,
            input.pagespeed?.scores["best-practices"] ?? null,
            input.securityHeaders ? securityHeadersScore(input.securityHeaders) : null,
          ]),
          CATEGORY_SOURCES.security,
          failures,
        );

  const categories = {
    performance,
    seo: finalize(seo, CATEGORY_SOURCES.seo, failures),
    accessibility: finalize(accessibility, CATEGORY_SOURCES.accessibility, failures),
    security,
  };
  const overall = averageOf(Object.values(categories).map((category) => category.score));
  const roundedOverall = overall === null ? null : Math.round(overall);

  return {
    overall: roundedOverall ?? 0,
    overallSeverity: roundedOverall === null ? "indisponivel" : severityFor(roundedOverall),
    ...categories,
  };
}
