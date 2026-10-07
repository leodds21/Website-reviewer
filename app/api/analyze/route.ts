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

// Explicit, not just the default: this route uses node:net/node:dns
// (lib/safeFetch.ts's SSRF blocklist), which don't exist on the Edge
// runtime — if Next's default runtime choice ever changed, silently
// switching runtimes here would break that protection outright rather
// than failing loudly.
export const runtime = "nodejs";

// PAGESPEED_TIMEOUT_MS (lib/timeouts.ts) alone is 50s, and it's the
// longest-running of the checks that run concurrently — so the
// route's own worst-case wall-clock time is close to that, not the
// sum of every check's timeout. Without an explicit ceiling here, a
// slow-but-legitimate analysis can get killed by whatever the
// platform's own default duration limit happens to be, which is
// usually well under that — a real, likely-already-happening failure
// mode in production, not just a hypothetical. 60s leaves a small
// buffer over the known worst case for scoring/caching/stream
// teardown, without requesting more time than the route can ever
// actually use.
export const maxDuration = 60;

/**
 * Error responses keep their real HTTP status (429 with Retry-After,
 * 400 for bad input) — the status is the honest signal for anything
 * that isn't our own UI. The body carries a code rather than a
 * sentence so the client can render it in the visitor's language.
 */
function errorResponse(error: AnalyzeError, status: number, headers?: Record<string, string>) {
  return NextResponse.json(error, { status, headers });
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Tells nginx-style reverse proxies not to buffer the response.
  // Without it, a proxy can hold every step event until the stream
  // closes, turning the live progress screen into a long freeze
  // followed by everything at once.
  "X-Accel-Buffering": "no",
};

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// The loading screen's step events each task completes. The page fetch
// feeds two (meta tags and image alt text) and the https check feeds
// the security-header step too, since both derive from one request.
const TASK_STEPS: Record<CheckKey, StepKey[]> = {
  https: ["https", "securityHeaders"],
  page: ["metaTags", "altImages"],
  sitemapRobots: ["sitemapRobots"],
  pagespeed: ["pagespeed"],
  brokenLinks: ["brokenLinks"],
};

type ParsedTargetUrl = { ok: true; url: URL } | { ok: false; reason: "invalid" | "blocked" };

// Malformed input and a URL that's syntactically fine but points at a
// blocked host (SSRF guard) are different problems for the visitor —
// "you typed it wrong" versus "that kind of address isn't allowed" —
// so callers get enough to pick the right AnalyzeErrorCode instead of
// collapsing both into one generic "invalid".
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

/**
 * Consumes a map of promises in the order they actually settle, one at
 * a time — what the "analisando" screen reports is real completion
 * order, not a scripted sequence, so a slow check really does keep the
 * client waiting on that label.
 */
async function* settleInOrder<T extends Record<string, Promise<unknown>>>(
  tasks: T,
): AsyncGenerator<
  { [K in keyof T]: { key: K; value: Awaited<T[K]> } | { key: K; error: unknown } }[keyof T]
> {
  const pending = new Map(
    Object.entries(tasks).map(([key, promise]) => [
      key,
      promise.then((value) => ({ key, value })).catch((error) => ({ key, error })),
    ]),
  );

  while (pending.size > 0) {
    const settled = await Promise.race(pending.values());
    pending.delete(settled.key);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yield settled as any;
  }
}

export async function GET(request: Request) {
  // When the platform stops this function (maxDuration), with a few
  // seconds kept for scoring, caching and closing the stream.
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
  // Path-aware: hostname alone would serve example.com/produtos's
  // report for a request about example.com/sobre, silently wrong for
  // any site analyzed at more than one path. Query/hash intentionally
  // excluded — those more often vary per-visitor (tracking params)
  // than change what's actually being analyzed.
  const cacheKey = `${targetUrl.origin}${targetUrl.pathname}`;

  // A cached report costs no PageSpeed quota, so it's answered before
  // the rate limit, not counted against it: reopening a report link,
  // reloading it or going back to it in the browser repeats the same
  // request, and each one used to spend one of the visitor's 10/hour.
  const cached = await getCached<AnalyzeReport>(cacheKey);
  if (cached) return new Response(sseFrame("done", cached), { headers: SSE_HEADERS });

  // The leftmost entry in x-forwarded-for is whatever the client
  // itself claims — trivially spoofable with a header. The rightmost
  // entry is the one appended by our own trusted edge (Vercel), so
  // that's the one to trust. This assumes exactly one trusted proxy in
  // front of the app; an additional untrusted proxy in the chain would
  // still need its own handling.
  const ip = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "unknown";
  const rateLimit = await checkRateLimit(ip);
  if (rateLimit.limited) {
    return errorResponse({ code: "rate-limited", retryAfterSeconds: rateLimit.retryAfterSeconds }, 429, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  const encoder = new TextEncoder();

  // Ties every check's fetch to the client connection: if the visitor
  // closes the tab mid-analysis, this aborts the still-running checks
  // (including the up-to-50s PageSpeed call) instead of letting them
  // burn quota and time for nobody.
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
          closed = true; // controller already closed client-side; nothing left to do
        }
      }

      function close() {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed — fine
        }
      }

      try {
        const results: Partial<CheckResults> = {};
        let platform: TechPlatform | null = null;
        // Why each failed check failed, in visitor-explainable terms: the
        // report turns these into "não medido, porque..." instead of a
        // bare "não avaliado", and they decide the top-level error code
        // when nothing at all could be measured.
        const failures: CheckFailures = {};
        // brokenLinks derives from the same `pageFetch` promise as the
        // "page" task (see `tasks` below): when fetchHtml itself fails,
        // that rejection forwards unchanged into brokenLinks too, so the
        // exact same Error object would otherwise get logged twice for
        // one root cause. Tracked by reference, not by task key, so it
        // stays correct if another derived task is added later.
        const loggedErrors = new Set<unknown>();

        // https gets the raw user input (not the https-forced `target`)
        // since its whole job is testing whether a plain-http request
        // gets upgraded — feeding it an already-https URL made "site
        // doesn't serve HTTPS at all" nearly unreachable as a finding.
        const httpsCheck = checkHttps(rawUrl, abortController.signal);

        // Every other check goes to https:// first. A site that only
        // serves plain HTTP refuses that, which used to leave its whole
        // report at the security score alone (overall 0). So a check that
        // fails retries over http:// once the https check confirms there
        // is no usable HTTPS: the site's other problems still get found,
        // and the missing HTTPS is still its own critical finding.
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
          // A retry can't wait PageSpeed's full time a second time: it gets
          // whatever is left before the platform cuts the function off.
          pagespeed: withHttpFallback((url) =>
            runPageSpeed(
              url,
              url === target ? abortController.signal : AbortSignal.any([abortController.signal, AbortSignal.timeout(Math.max(1, deadline - Date.now()))]),
            ),
          ),
          // Waits on the same fetch page/metaTags/altImages already use
          // (see the "page" outcome below) instead of fetching the page a
          // second time — only the up-to-10 link checks themselves are
          // new requests, against links the site's own home page links to.
          // Resolved against the address the page actually came from.
          brokenLinks: pageFetch.then(({ html, url }) => checkBrokenLinks(html, url, abortController.signal)),
        };

        for await (const outcome of settleInOrder(tasks)) {
          if ("error" in outcome) {
            failures[outcome.key] = classifyCheckFailure(outcome.error);
            // Logged server-side only — the client gets a generic
            // message (see below), never this raw detail.
            if (!loggedErrors.has(outcome.error)) {
              loggedErrors.add(outcome.error);
              console.error(`Checagem "${outcome.key}" falhou para ${target}:`, outcome.error);
            }
          } else if (outcome.key === "page") {
            // metaTags and altImages both just parse this same fetch —
            // they used to each fetch the page independently, tripling
            // traffic against the (third-party) site being analyzed.
            results.metaTags = parseMetaTags(outcome.value.html);
            results.altImages = parseAltImages(outcome.value.html);
            platform = detectTech(outcome.value.html).platform;
          } else if (outcome.key === "https") {
            // securityHeaders reads off the same response checkHttps
            // already fetched — no request of its own, so it isn't a
            // separate entry in `tasks`, just derived data the moment
            // https settles. Only meaningful once the connection is
            // actually secure (see deriveIssues).
            results.https = outcome.value;
            if (outcome.value.passed && outcome.value.headers) {
              results.securityHeaders = parseSecurityHeaders(outcome.value.headers);
            }
          } else {
            results[outcome.key] = outcome.value as never;
          }

          // A step means "this check is done", whether it produced a
          // result or failed: before, a failed check never sent one, so
          // its group on the loading screen kept spinning until the whole
          // report arrived, and the progress bar never got its share.
          for (const step of TASK_STEPS[outcome.key]) send("step", { step });
        }

        if (request.signal.aborted) {
          // The visitor left mid-analysis. Nothing to send, and caching
          // the half-finished results would serve this degraded report
          // to the *next* visitor for the full partial TTL.
          return;
        }

        if (Object.keys(results).length === 0) {
          // A bare code, not a sentence: the real reason (a missing API
          // key, the exact PageSpeed error body, an internal hostname a
          // redirect resolved to) is exactly the detail an SSRF/config
          // guard exists to keep off the client. The classified reason
          // is safe to pass on, and each of these has a real, actionable
          // answer ("tenta amanhã", "confere o endereço") where a
          // generic failure doesn't.
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
            // Drives the "este site recusa ferramentas automáticas" note
            // and the manual-analysis offer in the report.
            blocked: Object.values(failures).includes("blocked"),
            checkedAt: new Date().toISOString(),
          };
          // A report where some checks failed to run shouldn't be
          // trusted as long as a complete one — a transient failure
          // (a slow site timing out) shouldn't lock every visitor into a
          // degraded report for the full 6h TTL. "Complete" ignores the
          // page/metaTags/altImages split (one fetch, two derived
          // results) by checking failures directly instead of key count.
          const isComplete = Object.keys(failures).length === 0;
          await setCached(cacheKey, report, isComplete ? FULL_TTL_MS : PARTIAL_TTL_MS);
          send("done", report);
        }
      } catch (error) {
        // Anything unexpected past this point (a bug in scoring, a
        // serialization failure) would otherwise error the stream
        // mid-flight: the visitor gets a dropped connection and the
        // still-running checks keep burning PageSpeed quota for nobody.
        console.error(`Análise de ${target} falhou de forma inesperada:`, error);
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
