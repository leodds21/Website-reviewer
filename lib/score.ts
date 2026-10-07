import type { AltImagesCheckResult } from "./checks/altImages";
import type { BrokenLinksCheckResult } from "./checks/brokenLinks";
import type { CheckResults } from "./checkResults";
import { primaryReason, type CheckFailures, type CheckKey, type FailureReason } from "./checkFailure";
import type { Issue, IssueCode } from "./issues";

export type Severity = "critico" | "atencao" | "ok" | "indisponivel";

/** The measurements a category's score is the plain average of. */
export type ScoreComponentKey =
  | "google-performance"
  | "google-seo"
  | "title"
  | "description"
  | "links"
  | "google-accessibility"
  | "viewport"
  | "alt-images"
  | "https"
  | "google-best-practices";

/**
 * One measurement that went into a category's average, with what it
 * cost: in an average of N, a measurement worth `value` takes exactly
 * (100 - value) / N points off a perfect 100. `lost` is that, rounded
 * so a category's losses add up to exactly 100 minus its score.
 */
export type ScoreComponent = { key: ScoreComponentKey; value: number; lost: number };

// A category always carries an answer: a score (flagged partial when
// some of its sources failed, so the UI can say "medido em parte"), or
// the reason it couldn't be measured at all, so the UI never has to
// show a bare "não avaliado". `components` is what the score was
// averaged from; reports cached before it existed don't have it.
export type CategoryScore =
  | { score: number; severity: Exclude<Severity, "indisponivel">; partial: boolean; components?: ScoreComponent[] }
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

// Averages only the values that exist; null when none do. Categories
// leave out the measurements whose check didn't run (see finalize);
// overall leaves out the categories that couldn't be measured.
function averageOf(values: (number | null)[]): number | null {
  const available = values.filter((value): value is number => value !== null);
  return available.length === 0 ? null : average(available);
}

// The https signal for a site whose secure version works but isn't the
// default. Alone or averaged with a clean best-practices score it lands
// in "atencao" (50 to 75): matching the finding's severity, and clearly
// above the 0 of a site with no HTTPS at all.
const HTTPS_WITHOUT_REDIRECT_SCORE = 50;

// Which checks each category draws on — what "partial" and the
// unavailable reason are computed from.
const CATEGORY_SOURCES = {
  performance: ["pagespeed"],
  seo: ["pagespeed", "page", "brokenLinks"],
  accessibility: ["pagespeed", "page"],
  security: ["https", "pagespeed"],
} satisfies Record<string, CheckKey[]>;

/**
 * What each measurement took off a perfect 100, as whole points that
 * add up to exactly 100 - score. The exact shares, (100 - value) / N,
 * are usually fractional; each is rounded down and the points left
 * over go to the largest remainders (ties to the earlier measurement),
 * so every number shown is within a point of the exact one and the
 * column still sums to the score the visitor sees.
 */
function pointsLost(values: number[], score: number): number[] {
  const exact = values.map((value) => (100 - value) / values.length);
  const lost = exact.map(Math.floor);
  let leftover = 100 - score - lost.reduce((sum, points) => sum + points, 0);
  const byRemainder = exact.map((share, index) => ({ index, remainder: share - lost[index] })).sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (leftover <= 0) break;
    lost[index] += 1;
    leftover -= 1;
  }
  return lost;
}

type Measurement = { key: ScoreComponentKey; value: number | null };

// A category is the plain average of the measurements that ran, and
// those same measurements are kept as its explanation, so the score and
// the breakdown can't disagree. With none it's "indisponivel", never a
// fabricated 0 or 100, and says why. With no recorded failure among its
// sources, the checks ran but didn't yield this number (Lighthouse can
// skip a single category), hence "measurement-failed".
function finalize(measurements: Measurement[], sources: CheckKey[], failures: CheckFailures): CategoryScore {
  const reasons = sources.map((key) => failures[key]);
  const taken = measurements.filter((measurement): measurement is { key: ScoreComponentKey; value: number } => measurement.value !== null);
  if (taken.length === 0) {
    return { score: null, severity: "indisponivel", reason: primaryReason(reasons) ?? "measurement-failed" };
  }
  const values = taken.map((measurement) => measurement.value);
  const rounded = Math.round(average(values));
  const lost = pointsLost(values, rounded);
  return {
    score: rounded,
    severity: severityFor(rounded),
    partial: reasons.some(Boolean),
    components: taken.map((measurement, index) => ({ ...measurement, lost: lost[index] })),
  };
}

/**
 * Combines PageSpeed's Lighthouse categories with our own checks into
 * the four categories the report shows. Performance is Lighthouse's
 * number as-is (nothing of ours adds signal there); the others blend
 * Lighthouse with our own checks.
 *
 * Only checks that produce a critico/atencao finding feed the score, so
 * every point lost shows up in the findings list. Suggestion-level ones
 * (sitemap, security hardening headers) are listed but never lower the
 * score, and robots.txt isn't scored at all: without one, crawlers
 * simply index everything, which is fine for most sites.
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
  const performance = finalize(
    [{ key: "google-performance", value: input.pagespeed?.scores.performance ?? null }],
    CATEGORY_SOURCES.performance,
    failures,
  );

  // Our own HTML parse when we got the page; Lighthouse's audit of the
  // same thing when our fetch was refused but Google's wasn't.
  const lighthouse = input.pagespeed;
  const seo = finalize(
    [
      { key: "google-seo", value: input.pagespeed?.scores.seo ?? null },
      { key: "title", value: booleanSignal(input.metaTags ? input.metaTags.hasTitle : lighthouse?.hasTitle) },
      { key: "description", value: booleanSignal(input.metaTags ? input.metaTags.hasDescription : lighthouse?.hasDescription) },
      { key: "links", value: input.brokenLinks ? brokenLinksScore(input.brokenLinks) : null },
    ],
    CATEGORY_SOURCES.seo,
    failures,
  );

  const accessibility = finalize(
    [
      { key: "google-accessibility", value: input.pagespeed?.scores.accessibility ?? null },
      { key: "viewport", value: booleanSignal(input.metaTags ? input.metaTags.hasViewport : lighthouse?.hasViewport) },
      // No Lighthouse fallback here: its image-alt audit is pass/fail, so
      // one undescribed image would count as a flat 0 (our own sample is
      // proportional), and Lighthouse's accessibility score above already
      // accounts for it. It still produces the finding (lib/issues.ts).
      { key: "alt-images", value: input.altImages ? altImagesScore(input.altImages) : null },
    ],
    CATEGORY_SOURCES.accessibility,
    failures,
  );

  // Security has no meaning at all without the https check specifically
  // — best-practices alone isn't a security signal, it's a secondary
  // bump on top of a confirmed-secure connection. A failed https check
  // drives security straight to 0 regardless of best-practices
  // (everything else about a site is moot if it's not served securely);
  // a missing https check makes the whole category indisponivel, not a
  // guess based on best-practices alone. A failed https check is a
  // complete answer on its own, so nothing else missing makes it partial.
  // HTTPS that works but isn't the default (http:// never redirects)
  // counts for less than full marks, not for nothing: the secure
  // version exists, visitors just have to ask for it.
  const httpsSignal = input.https?.noHttpRedirect ? HTTPS_WITHOUT_REDIRECT_SCORE : 100;
  const security = !input.https
    ? finalize([], CATEGORY_SOURCES.security, failures)
    : !input.https.passed
      ? finalize([{ key: "https", value: 0 }], [], failures)
      : finalize(
          [
            { key: "https", value: httpsSignal },
            { key: "google-best-practices", value: input.pagespeed?.scores["best-practices"] ?? null },
          ],
          CATEGORY_SOURCES.security,
          failures,
        );

  const categories = { performance, seo, accessibility, security };
  const overall = averageOf(Object.values(categories).map((category) => category.score));
  const roundedOverall = overall === null ? null : Math.round(overall);

  return {
    overall: roundedOverall ?? 0,
    overallSeverity: roundedOverall === null ? "indisponivel" : severityFor(roundedOverall),
    ...categories,
  };
}

/**
 * Which findings explain which measurement: a relation, not a rule.
 * deriveIssues alone decides when a finding exists; this only says
 * which measurement's lost points it accounts for. Findings with no
 * entry (a generic title, the suggestions) don't cost points.
 */
export const COMPONENT_ISSUES: Record<ScoreComponentKey, IssueCode[]> = {
  "google-performance": ["slow-load-impact", "layout-shift", "slow-server-response", "low-performance"],
  "google-seo": [],
  title: ["no-title"],
  description: ["no-description"],
  links: ["broken-links"],
  "google-accessibility": ["color-contrast", "missing-form-labels"],
  viewport: ["no-viewport"],
  "alt-images": ["missing-alt"],
  https: ["no-https", "invalid-certificate", "no-https-redirect"],
  "google-best-practices": [],
};

/**
 * How many points of the overall score a finding accounts for: what
 * its measurement took off its category, spread over the categories
 * the overall score averages. Only used to order findings, never
 * shown. 0 when the finding costs nothing, and for reports cached
 * before categories kept their measurements.
 */
export function issueScoreImpact(issue: Issue, score: AggregatedScore): number {
  const category = score[issue.category];
  const component = category.score === null ? undefined : category.components?.find((c) => COMPONENT_ISSUES[c.key].includes(issue.code));
  if (!component) return 0;
  const scoredCategories = [score.performance, score.seo, score.accessibility, score.security].filter((c) => c.score !== null).length;
  return component.lost / scoredCategories;
}
