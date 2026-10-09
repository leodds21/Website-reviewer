import type { AltImagesCheckResult } from "./checks/altImages";
import type { BrokenLinksCheckResult } from "./checks/brokenLinks";
import type { CheckResults } from "./checkResults";
import { primaryReason, type CheckFailures, type CheckKey, type FailureReason } from "./checkFailure";
import type { Issue, IssueCode } from "./issues";

export type Severity = "critico" | "atencao" | "ok" | "indisponivel";

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

/** One measurement in a category's average. `lost` is what it took off 100. */
export type ScoreComponent = {
  key: ScoreComponentKey;
  value: number;
  lost: number;
  // Elements measured (alt-images, links). 0 means there was nothing to check.
  count?: number;
};

// Reports cached before `components` existed don't have it.
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

// A page with no links scores as clean. Links that exist but couldn't be
// verified make checkBrokenLinks throw instead of returning 0 checked.
function brokenLinksScore(result: BrokenLinksCheckResult): number {
  if (result.checkedCount === 0) return 100;
  return ((result.checkedCount - result.brokenCount) / result.checkedCount) * 100;
}

// Unknown contributes nothing rather than counting as a failure.
function booleanSignal(value: boolean | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return value ? 100 : 0;
}

function averageOf(values: (number | null)[]): number | null {
  const available = values.filter((value): value is number => value !== null);
  return available.length === 0 ? null : average(available);
}

// HTTPS works but http:// doesn't redirect: lands in "atencao", well above no HTTPS.
const HTTPS_WITHOUT_REDIRECT_SCORE = 50;

const CATEGORY_SOURCES = {
  performance: ["pagespeed"],
  seo: ["pagespeed", "page", "brokenLinks"],
  accessibility: ["pagespeed", "page"],
  security: ["https", "pagespeed"],
} satisfies Record<string, CheckKey[]>;

// Largest-remainder rounding, so the shown points add up to exactly 100 - score.
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

type Measurement = { key: ScoreComponentKey; value: number | null; count?: number };

// No failure recorded but no value either: Lighthouse can skip a single category.
function finalize(measurements: Measurement[], sources: CheckKey[], failures: CheckFailures): CategoryScore {
  const reasons = sources.map((key) => failures[key]);
  const taken = measurements.filter((measurement): measurement is Measurement & { value: number } => measurement.value !== null);
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
 * Only checks with critico/atencao findings feed the score; suggestions
 * (sitemap, hardening headers) never lower it, and robots.txt isn't scored.
 * A check that failed contributes nothing, never a made-up 0 or 100.
 */
export function aggregateScore(input: Partial<CheckResults>, failures: CheckFailures = {}): AggregatedScore {
  const performance = finalize(
    [{ key: "google-performance", value: input.pagespeed?.scores.performance ?? null }],
    CATEGORY_SOURCES.performance,
    failures,
  );

  // Lighthouse's audit stands in when our own fetch was refused.
  const lighthouse = input.pagespeed;
  const seo = finalize(
    [
      { key: "google-seo", value: input.pagespeed?.scores.seo ?? null },
      { key: "title", value: booleanSignal(input.metaTags ? input.metaTags.hasTitle : lighthouse?.hasTitle) },
      { key: "description", value: booleanSignal(input.metaTags ? input.metaTags.hasDescription : lighthouse?.hasDescription) },
      { key: "links", value: input.brokenLinks ? brokenLinksScore(input.brokenLinks) : null, count: input.brokenLinks?.checkedCount },
    ],
    CATEGORY_SOURCES.seo,
    failures,
  );

  const accessibility = finalize(
    [
      { key: "google-accessibility", value: input.pagespeed?.scores.accessibility ?? null },
      { key: "viewport", value: booleanSignal(input.metaTags ? input.metaTags.hasViewport : lighthouse?.hasViewport) },
      // No Lighthouse fallback: its image-alt audit is pass/fail, ours is proportional.
      { key: "alt-images", value: input.altImages ? altImagesScore(input.altImages) : null, count: input.altImages?.sampledCount },
    ],
    CATEGORY_SOURCES.accessibility,
    failures,
  );

  // Without the https check there is no security score; failed HTTPS is 0
  // whatever best-practices says.
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

/** Which findings account for each measurement's lost points. */
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

/** Overall-score points a finding accounts for. Used only to order findings. */
export function issueScoreImpact(issue: Issue, score: AggregatedScore): number {
  const category = score[issue.category];
  const component = category.score === null ? undefined : category.components?.find((c) => COMPONENT_ISSUES[c.key].includes(issue.code));
  if (!component) return 0;
  const scoredCategories = [score.performance, score.seo, score.accessibility, score.security].filter((c) => c.score !== null).length;
  return component.lost / scoredCategories;
}
