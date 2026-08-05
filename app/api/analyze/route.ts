import { NextResponse } from "next/server";
import { checkHttps, type HttpsCheckResult } from "@/lib/checks/https";
import { parseMetaTags, type MetaTagsCheckResult } from "@/lib/checks/meta-tags";
import { parseAltImages, type AltImagesCheckResult } from "@/lib/checks/alt-images";
import { checkSitemapRobots, type SitemapRobotsCheckResult } from "@/lib/checks/sitemap-robots";
import { runPageSpeed, type PageSpeedResult } from "@/lib/pagespeed";
import { fetchHtml } from "@/lib/fetchHtml";
import { getCached, setCached, FULL_TTL_MS, PARTIAL_TTL_MS } from "@/lib/cache";
import { aggregateScore } from "@/lib/score";
import { deriveIssues } from "@/lib/issues";
import { checkRateLimit } from "@/lib/rateLimit";
import { isBlockedHost } from "@/lib/safeFetch";
import { normalizeUrl } from "@/lib/url";
import type { AnalyzeReport } from "@/lib/report";

export const dynamic = "force-dynamic";

type CheckResults = {
  https: HttpsCheckResult;
  metaTags: MetaTagsCheckResult;
  altImages: AltImagesCheckResult;
  sitemapRobots: SitemapRobotsCheckResult;
  pagespeed: PageSpeedResult;
};

function parseTargetUrl(input: string): URL | null {
  try {
    const url = new URL(normalizeUrl(input));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (isBlockedHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
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
  // The leftmost entry in x-forwarded-for is whatever the client
  // itself claims — trivially spoofable with a header. The rightmost
  // entry is the one appended by our own trusted edge (Vercel), so
  // that's the one to trust. This assumes exactly one trusted proxy in
  // front of the app; an additional untrusted proxy in the chain would
  // still need its own handling.
  const ip = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(ip);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Muitas análises em pouco tempo. Tenta de novo mais tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawUrl = (searchParams.get("url") ?? "").trim();

  if (!rawUrl) {
    return NextResponse.json({ error: "Informe uma URL." }, { status: 400 });
  }

  const targetUrl = parseTargetUrl(rawUrl);
  if (!targetUrl) {
    return NextResponse.json({ error: "URL inválida." }, { status: 400 });
  }

  const domain = targetUrl.hostname;
  const target = targetUrl.toString();
  // Path-aware: hostname alone would serve example.com/produtos's
  // report for a request about example.com/sobre, silently wrong for
  // any site analyzed at more than one path. Query/hash intentionally
  // excluded — those more often vary per-visitor (tracking params)
  // than change what's actually being analyzed.
  const cacheKey = `${targetUrl.origin}${targetUrl.pathname}`;
  const encoder = new TextEncoder();

  // Ties every check's fetch to the client connection: if the visitor
  // closes the tab mid-analysis, this aborts the still-running checks
  // (including the up-to-30s PageSpeed call) instead of letting them
  // burn quota and time for nobody.
  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
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

      const cached = getCached<AnalyzeReport>(cacheKey);
      if (cached) {
        send("done", cached);
        close();
        return;
      }

      const results: Partial<CheckResults> = {};
      let sawFailure = false;

      // https gets the raw user input (not the https-forced `target`)
      // since its whole job is testing whether a plain-http request
      // gets upgraded — feeding it an already-https URL made "site
      // doesn't serve HTTPS at all" nearly unreachable as a finding.
      const tasks = {
        https: checkHttps(rawUrl, abortController.signal),
        page: fetchHtml(target, abortController.signal),
        sitemapRobots: checkSitemapRobots(target, abortController.signal),
        pagespeed: runPageSpeed(target, abortController.signal),
      };

      for await (const outcome of settleInOrder(tasks)) {
        if ("error" in outcome) {
          sawFailure = true;
          // Logged server-side only — the client gets a generic
          // message (see below), never this raw detail.
          console.error(`Checagem "${outcome.key}" falhou para ${target}:`, outcome.error);
          continue;
        }

        if (outcome.key === "page") {
          // metaTags and altImages both just parse this same fetch —
          // they used to each fetch the page independently, tripling
          // traffic against the (third-party) site being analyzed.
          results.metaTags = parseMetaTags(outcome.value);
          results.altImages = parseAltImages(outcome.value);
          send("step", { step: "metaTags" });
          send("step", { step: "altImages" });
          continue;
        }

        results[outcome.key] = outcome.value as never;
        send("step", { step: outcome.key });
      }

      if (Object.keys(results).length === 0) {
        // Deliberately generic: the real reason (a missing API key, the
        // exact PageSpeed error body, an internal hostname a redirect
        // resolved to) is exactly the kind of detail an SSRF/config
        // guard exists to keep off the client.
        send("failed", { error: "Não foi possível analisar o site. Tenta de novo em instantes." });
      } else {
        const score = aggregateScore(results);
        const issues = deriveIssues(results);
        const report: AnalyzeReport = { domain, score, issues, checkedAt: new Date().toISOString() };
        // A report where some checks failed to run shouldn't be
        // trusted as long as a complete one — a transient failure
        // (a slow site timing out) shouldn't lock every visitor into a
        // degraded report for the full 6h TTL. "Complete" ignores the
        // page/metaTags/altImages split (one fetch, two derived
        // results) by checking sawFailure directly instead of key count.
        const isComplete = !sawFailure;
        setCached(cacheKey, report, isComplete ? FULL_TTL_MS : PARTIAL_TTL_MS);
        send("done", report);
      }

      close();
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
