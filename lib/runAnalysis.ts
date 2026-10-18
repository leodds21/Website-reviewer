import { checkHttps } from "./checks/https";
import { parseSecurityHeaders } from "./checks/securityHeaders";
import { parseMetaTags } from "./checks/metaTags";
import { parseAltImages } from "./checks/altImages";
import { checkSitemapRobots } from "./checks/sitemapRobots";
import { detectTech, type TechPlatform } from "./checks/techDetect";
import { checkBrokenLinks } from "./checks/brokenLinks";
import { parseIndexing } from "./checks/indexing";
import { parseSocialPreview } from "./checks/socialPreview";
import { parseStructuredData } from "./checks/structuredData";
import { parseHtmlLang } from "./checks/htmlLang";
import { parseMixedContent } from "./checks/mixedContent";
import { parseFavicon } from "./checks/favicon";
import { runPageSpeed } from "./pagespeed";
import { classifyCheckFailure, primaryReason, type CheckFailures, type CheckKey, type FailureReason } from "./checkFailure";
import { fetchHtml } from "./fetchHtml";
import { buildReport } from "./buildReport";
import type { CheckResults } from "./checkResults";
import type { StepKey } from "./scanSteps";
import type { AnalyzeReport } from "./report";
import type { AnalyzeErrorCode } from "./analyzeError";

// Progress steps each task completes; one fetch can feed more than one step.
const TASK_STEPS: Record<CheckKey, StepKey[]> = {
  https: ["https", "securityHeaders"],
  page: ["metaTags", "altImages"],
  sitemapRobots: ["sitemapRobots"],
  pagespeed: ["pagespeed"],
  brokenLinks: ["brokenLinks"],
};

// Our own checks. Once they're all in, the partial report can't lose a finding:
// PageSpeed only adds to it.
const OWN_TASKS: CheckKey[] = ["https", "page", "sitemapRobots", "brokenLinks"];

// Only the classified reason reaches the client, never the raw error.
const TOTAL_FAILURE_CODE: Partial<Record<FailureReason, AnalyzeErrorCode>> = {
  blocked: "site-blocked",
  quota: "quota-exceeded",
  timeout: "timeout",
  unreachable: "site-unreachable",
};

export type AnalysisOutcome =
  | { kind: "report"; report: AnalyzeReport; complete: boolean }
  | { kind: "failed"; code: AnalyzeErrorCode }
  | { kind: "aborted" };

export type AnalysisCallbacks = {
  onStep: (step: StepKey) => void;
  onPartial: (report: AnalyzeReport) => void;
};

type Settled<T extends Record<string, Promise<unknown>>> = {
  [K in keyof T]: { key: K; value: Awaited<T[K]> } | { key: K; error: unknown };
}[keyof T];

/** Yields each task's outcome in the order it actually settles. */
async function* settleInOrder<T extends Record<string, Promise<unknown>>>(tasks: T): AsyncGenerator<Settled<T>> {
  const pending = new Map<keyof T, Promise<Settled<T>>>();
  // TypeScript can't relate a generic key to its own entry of the union.
  for (const key of Object.keys(tasks) as (keyof T & string)[]) {
    pending.set(
      key,
      tasks[key].then(
        (value) => ({ key, value }) as Settled<T>,
        (error: unknown) => ({ key, error }) as Settled<T>,
      ),
    );
  }

  while (pending.size > 0) {
    const settled = await Promise.race(pending.values());
    pending.delete(settled.key);
    yield settled;
  }
}

export async function runAnalysis(
  { rawUrl, target, domain, signal, deadline }: { rawUrl: string; target: string; domain: string; signal: AbortSignal; deadline: number },
  { onStep, onPartial }: AnalysisCallbacks,
): Promise<AnalysisOutcome> {
  const checkedAt = new Date().toISOString();
  const results: Partial<CheckResults> = {};
  let platform: TechPlatform | null = null;
  const failures: CheckFailures = {};
  const settled = new Set<CheckKey>();
  let partialSent = false;
  // brokenLinks reuses the page fetch, so one failure can surface twice.
  const loggedErrors = new Set<unknown>();

  // The raw input, so the check can see whether http:// redirects.
  const httpsCheck = checkHttps(rawUrl, signal);

  // Checks try https:// first and retry over http:// only for sites
  // without usable HTTPS.
  const httpTarget = new URL(target);
  httpTarget.protocol = "http:";
  async function withHttpFallback<T>(run: (url: string) => Promise<T>): Promise<T> {
    try {
      return await run(target);
    } catch (error) {
      const https = await httpsCheck.catch(() => null);
      if (!https || https.passed || signal.aborted) throw error;
      return run(httpTarget.toString());
    }
  }

  const pageFetch = withHttpFallback((url) => fetchHtml(url, signal));

  const tasks = {
    https: httpsCheck,
    page: pageFetch,
    sitemapRobots: withHttpFallback((url) => checkSitemapRobots(url, signal)),
    // Never past the deadline: a run that took over from another request
    // starts late, and must still finish (and free its lock) in time.
    pagespeed: withHttpFallback((url) => runPageSpeed(url, AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, deadline - Date.now()))]))),
    brokenLinks: pageFetch.then(({ html, finalUrl }) => checkBrokenLinks(html, finalUrl, signal)),
  };

  for await (const outcome of settleInOrder(tasks)) {
    settled.add(outcome.key);
    if ("error" in outcome) {
      failures[outcome.key] = classifyCheckFailure(outcome.error);
      if (!loggedErrors.has(outcome.error)) {
        loggedErrors.add(outcome.error);
        console.error(`Check "${outcome.key}" failed for ${target}:`, outcome.error);
      }
    } else if (outcome.key === "page") {
      const { html, headers, finalUrl } = outcome.value;
      results.metaTags = parseMetaTags(html);
      results.altImages = parseAltImages(html);
      results.indexing = parseIndexing(html, headers.get("x-robots-tag"));
      results.socialPreview = parseSocialPreview(html);
      results.structuredData = parseStructuredData(html);
      results.htmlLang = parseHtmlLang(html);
      results.favicon = parseFavicon(html);
      // An http:// page has nothing to mix: it's all insecure.
      if (finalUrl.startsWith("https:")) results.mixedContent = parseMixedContent(html, headers.get("content-security-policy"));
      platform = detectTech(html).platform;
    } else if (outcome.key === "https") {
      results.https = outcome.value;
      // Security headers only mean something over a secure connection.
      if (outcome.value.passed && outcome.value.headers) {
        results.securityHeaders = parseSecurityHeaders(outcome.value.headers);
      }
    } else {
      results[outcome.key] = outcome.value as never;
    }

    // A failed check still completes its steps on the progress screen.
    for (const step of TASK_STEPS[outcome.key]) onStep(step);

    if (signal.aborted) continue;
    if (!partialSent && !settled.has("pagespeed") && OWN_TASKS.every((key) => settled.has(key)) && Object.keys(results).length > 0) {
      partialSent = true;
      onPartial(buildReport({ domain, results, failures, platform, checkedAt, pending: ["pagespeed"] }));
    }
  }

  if (signal.aborted) return { kind: "aborted" };

  if (Object.keys(results).length === 0) {
    const reason = primaryReason(Object.values(failures));
    return { kind: "failed", code: (reason && TOTAL_FAILURE_CODE[reason]) ?? "analysis-failed" };
  }

  return {
    kind: "report",
    report: buildReport({ domain, results, failures, platform, checkedAt }),
    complete: Object.keys(failures).length === 0,
  };
}
