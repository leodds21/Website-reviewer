import { NextResponse } from "next/server";
import { getCached, setCached, FULL_TTL_MS, PARTIAL_TTL_MS } from "@/lib/cache";
import { checkRateLimit } from "@/lib/rateLimit";
import { isBlockedHost } from "@/lib/safeFetch";
import { normalizeUrl } from "@/lib/url";
import { runAnalysis } from "@/lib/runAnalysis";
import { sseFrame, type AnalysisEvent } from "@/lib/analysisEvents";
import type { AnalyzeReport } from "@/lib/report";
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
  if (cached) return new Response(sseFrame({ event: "done", data: cached }), { headers: SSE_HEADERS });

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

      function send(event: AnalysisEvent) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseFrame(event)));
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
        const outcome = await runAnalysis(
          { rawUrl, target, domain, signal: abortController.signal, deadline },
          {
            onStep: (step) => send({ event: "step", data: { step } }),
            onPartial: (report) => send({ event: "partial", data: report }),
          },
        );

        // The visitor left: don't cache a half-finished report.
        if (outcome.kind === "aborted") return;

        if (outcome.kind === "failed") {
          send({ event: "failed", data: { code: outcome.code } });
          return;
        }

        // Partial reports get a short TTL so a transient failure doesn't stick.
        await setCached(cacheKey, outcome.report, outcome.complete ? FULL_TTL_MS : PARTIAL_TTL_MS);
        send({ event: "done", data: outcome.report });
      } catch (error) {
        console.error(`Analysis of ${target} failed unexpectedly:`, error);
        abortController.abort();
        send({ event: "failed", data: { code: "analysis-failed" satisfies AnalyzeErrorCode } });
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
