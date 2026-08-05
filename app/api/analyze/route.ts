import { NextResponse } from "next/server";
import { checkHttps, type HttpsCheckResult } from "@/lib/checks/https";
import { checkMetaTags, type MetaTagsCheckResult } from "@/lib/checks/meta-tags";
import { checkAltImages, type AltImagesCheckResult } from "@/lib/checks/alt-images";
import { checkSitemapRobots, type SitemapRobotsCheckResult } from "@/lib/checks/sitemap-robots";
import { runPageSpeed, type PageSpeedResult } from "@/lib/pagespeed";
import { getCached, setCached } from "@/lib/cache";
import { aggregateScore, type AggregatedScore } from "@/lib/score";
import { deriveIssues, type Issue } from "@/lib/issues";
import { checkRateLimit } from "@/lib/rateLimit";
import { isBlockedHost } from "@/lib/safeFetch";

export const dynamic = "force-dynamic";

type AnalyzeReport = {
  domain: string;
  score: AggregatedScore;
  issues: Issue[];
  checkedAt: string;
};

type CheckResults = {
  https: HttpsCheckResult;
  metaTags: MetaTagsCheckResult;
  altImages: AltImagesCheckResult;
  sitemapRobots: SitemapRobotsCheckResult;
  pagespeed: PageSpeedResult;
};

const STEP_LABELS: Record<keyof CheckResults, string> = {
  https: "Verificando segurança",
  metaTags: "Verificando SEO",
  altImages: "Verificando acessibilidade",
  sitemapRobots: "Verificando SEO",
  pagespeed: "Verificando performance",
};

function parseTargetUrl(input: string): URL | null {
  const withScheme = input.startsWith("http://") || input.startsWith("https://")
    ? input
    : `https://${input}`;

  try {
    const url = new URL(withScheme);
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

// TODO(i18n): every error string below is Portuguese-only — the client
// currently shows them as-is regardless of UI language. Fixing this
// properly means either accepting a `lang` param here and returning a
// code the client maps through its own dictionary (consistent with how
// deriveIssues() already separates data from display text), or moving
// all error copy to the client and having routes return error codes
// instead of messages. Deferred: low-traffic path, not blocking.
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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      const cached = getCached<AnalyzeReport>(domain);
      if (cached) {
        send("done", cached);
        controller.close();
        return;
      }

      const results = {} as CheckResults;
      let failedMessage: string | null = null;

      const tasks = {
        https: checkHttps(target),
        metaTags: checkMetaTags(target),
        altImages: checkAltImages(target),
        sitemapRobots: checkSitemapRobots(target),
        pagespeed: runPageSpeed(target),
      };

      for await (const outcome of settleInOrder(tasks)) {
        if ("error" in outcome) {
          failedMessage ??= (outcome.error as Error).message;
          continue;
        }
        results[outcome.key] = outcome.value as never;
        send("step", { step: outcome.key, label: STEP_LABELS[outcome.key] });
      }

      if (failedMessage) {
        send("error", { error: `Não foi possível analisar o site: ${failedMessage}` });
      } else {
        const score = aggregateScore(results);
        const issues = deriveIssues(results);
        const report: AnalyzeReport = { domain, score, issues, checkedAt: new Date().toISOString() };
        setCached(domain, report);
        send("done", report);
      }

      controller.close();
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
