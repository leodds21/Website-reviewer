import { NextResponse } from "next/server";
import { checkHttps } from "@/lib/checks/https";
import { parseSecurityHeaders } from "@/lib/checks/securityHeaders";
import { parseMetaTags } from "@/lib/checks/metaTags";
import { parseAltImages } from "@/lib/checks/altImages";
import { checkSitemapRobots } from "@/lib/checks/sitemapRobots";
import { detectTech, type TechPlatform } from "@/lib/checks/techDetect";
import { checkBrokenLinks } from "@/lib/checks/brokenLinks";
import { runPageSpeed } from "@/lib/pagespeed";
import {
  classifyCheckFailure,
  primaryReason,
  type CheckFailures,
  type CheckKey,
  type FailureReason,
} from "@/lib/checkFailure";
import { fetchHtml } from "@/lib/fetchHtml";
import { getCached, setCached, FULL_TTL_MS, PARTIAL_TTL_MS } from "@/lib/cache";
import { aggregateScore } from "@/lib/score";
import { deriveIssues } from "@/lib/issues";
import { derivePasses } from "@/lib/passes";
import { checkRateLimit } from "@/lib/rateLimit";
import { isBlockedHost } from "@/lib/safeFetch";
import { normalizeUrl } from "@/lib/url";
import type { AnalyzeReport } from "@/lib/report";
import type { CheckResults } from "@/lib/checkResults";
import type { StepKey } from "@/lib/scanSteps";
import type { AnalyzeError, AnalyzeErrorCode } from "@/lib/analyzeError";

export const dynamic = "force-dynamic";

// The SSRF guard needs node:net and node:dns, which the Edge runtime lacks.
export const runtime = "nodejs";

// PageSpeed alone can take 50s; the default platform limit is lower.
export const maxDuration = 60;

// Real HTTP status for tools, a code (not a sentence) for the UI to translate.
function errorResponse(error: AnalyzeError, status: number, headers?: Record<string, string>) {
  return NextResponse.json(error, { status, headers });
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Stops nginx-style proxies from buffering the stream until it closes.
  "X-Accel-Buffering": "no",
};

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Progress steps each task completes; one fetch can feed more than one step.
const TASK_STEPS: Record<CheckKey, StepKey[]> = {
  https: ["https", "securityHeaders"],
  page: ["metaTags", "altImages"],
  sitemapRobots: ["sitemapRobots"],
  pagespeed: ["pagespeed"],
  brokenLinks: ["brokenLinks"],
};

type ParsedTargetUrl = { ok: true; url: URL } | { ok: false; reason: "invalid" | "blocked" };

// "Invalid" and "blocked" get different messages in the UI.
function parseTargetUrl(input: string): ParsedTargetUrl {
  try {
    const url = new URL(normalizeUrl(input));
    if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "invalid" };
    if (isBlockedHost(url.hostname)) return { ok: false, reason: "blocked" };
    return { ok: true, url };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

/** Yields each task's outcome in the order it actually settles. */
type Settled<T extends Record<string, Promise<unknown>>> = {
  [K in keyof T]: { key: K; value: Awaited<T[K]> } | { key: K; error: unknown };
}[keyof T];

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

export async function GET(request: Request) {
  // Leaves a few seconds before maxDuration for scoring and caching.
  const deadline = Date.now() + (maxDuration - 5) * 1000;
  const { searchParams } = new URL(request.url);
  const rawUrl = (searchParams.get("url") ?? "").trim();

  if (!rawUrl) {
    return errorResponse({ code: "missing-url" }, 400);
  }

  const parsedUrl = parseTargetUrl(rawUrl);
  if (!parsedUrl.ok) {
    return errorResponse({ code: parsedUrl.reason === "blocked" ? "blocked-url" : "invalid-url" }, 400);
  }
  const targetUrl = parsedUrl.url;

  const domain = targetUrl.hostname;
  const target = targetUrl.toString();
  // Per path; query and hash left out (they're usually tracking params).
  const cacheKey = `${targetUrl.origin}${targetUrl.pathname}`;

  // Cached reports cost nothing, so they don't count against the rate limit.
  const cached = await getCached<AnalyzeReport>(cacheKey);
  if (cached) return new Response(sseFrame("done", cached), { headers: SSE_HEADERS });

  // Report links only read the cache; a link alone never starts an analysis.
  if (searchParams.get("cached") === "only") return errorResponse({ code: "not-cached" }, 404);

  // The rightmost entry is the one Vercel appends; the rest can be spoofed.
  const ip = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "unknown";
  const rateLimit = await checkRateLimit(ip);
  if (rateLimit.limited) {
    return errorResponse({ code: "rate-limited", retryAfterSeconds: rateLimit.retryAfterSeconds }, 429, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  const encoder = new TextEncoder();

  // Closing the tab aborts the checks still running.
  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseFrame(event, data)));
        } catch {
          closed = true;
        }
      }

      function close() {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }

      try {
        const results: Partial<CheckResults> = {};
        let platform: TechPlatform | null = null;
        const failures: CheckFailures = {};
        // brokenLinks reuses the page fetch, so one failure can surface twice.
        const loggedErrors = new Set<unknown>();

        // The raw input, so the check can see whether http:// redirects.
        const httpsCheck = checkHttps(rawUrl, abortController.signal);

        // Checks try https:// first and retry over http:// only for sites
        // without usable HTTPS.
        const httpTarget = new URL(target);
        httpTarget.protocol = "http:";
        async function withHttpFallback<T>(run: (url: string) => Promise<T>): Promise<T> {
          try {
            return await run(target);
          } catch (error) {
            const https = await httpsCheck.catch(() => null);
            if (!https || https.passed || abortController.signal.aborted) throw error;
            return run(httpTarget.toString());
          }
        }

        const pageFetch = withHttpFallback(async (url) => ({ url, html: await fetchHtml(url, abortController.signal) }));

        const tasks = {
          https: httpsCheck,
          page: pageFetch,
          sitemapRobots: withHttpFallback((url) => checkSitemapRobots(url, abortController.signal)),
          // A retry only gets the time left before maxDuration.
          pagespeed: withHttpFallback((url) =>
            runPageSpeed(
              url,
              url === target ? abortController.signal : AbortSignal.any([abortController.signal, AbortSignal.timeout(Math.max(1, deadline - Date.now()))]),
            ),
          ),
          brokenLinks: pageFetch.then(({ html, url }) => checkBrokenLinks(html, url, abortController.signal)),
        };

        for await (const outcome of settleInOrder(tasks)) {
          if ("error" in outcome) {
            failures[outcome.key] = classifyCheckFailure(outcome.error);
            if (!loggedErrors.has(outcome.error)) {
              loggedErrors.add(outcome.error);
              console.error(`Check "${outcome.key}" failed for ${target}:`, outcome.error);
            }
          } else if (outcome.key === "page") {
            results.metaTags = parseMetaTags(outcome.value.html);
            results.altImages = parseAltImages(outcome.value.html);
            platform = detectTech(outcome.value.html).platform;
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
          for (const step of TASK_STEPS[outcome.key]) send("step", { step });
        }

        // The visitor left: don't cache a half-finished report.
        if (request.signal.aborted) {
          return;
        }

        if (Object.keys(results).length === 0) {
          // Only the classified reason reaches the client, never the raw error.
          const totalFailureCode: Partial<Record<FailureReason, AnalyzeErrorCode>> = {
            blocked: "site-blocked",
            quota: "quota-exceeded",
            timeout: "timeout",
            unreachable: "site-unreachable",
          };
          const reason = primaryReason(Object.values(failures));
          send("failed", { code: (reason && totalFailureCode[reason]) ?? "analysis-failed" });
        } else {
          const score = aggregateScore(results, failures);
          const issues = deriveIssues(results);
          const report: AnalyzeReport = {
            domain,
            score,
            issues,
            passed: derivePasses(results),
            loadSeconds: results.pagespeed?.lcpSeconds,
            platform,
            blocked: Object.values(failures).includes("blocked"),
            checkedAt: new Date().toISOString(),
          };
          // Partial reports get a short TTL so a transient failure doesn't stick.
          const isComplete = Object.keys(failures).length === 0;
          await setCached(cacheKey, report, isComplete ? FULL_TTL_MS : PARTIAL_TTL_MS);
          send("done", report);
        }
      } catch (error) {
        console.error(`Analysis of ${target} failed unexpectedly:`, error);
        abortController.abort();
        send("failed", { code: "analysis-failed" satisfies AnalyzeErrorCode });
      } finally {
        close();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
