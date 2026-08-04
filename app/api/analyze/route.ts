import { NextResponse } from "next/server";
import { checkHttps } from "@/lib/checks/https";
import { checkMetaTags } from "@/lib/checks/meta-tags";
import { checkAltImages } from "@/lib/checks/alt-images";
import { checkSitemapRobots } from "@/lib/checks/sitemap-robots";
import { runPageSpeed } from "@/lib/pagespeed";
import { getCached, setCached } from "@/lib/cache";
import { aggregateScore, type AggregatedScore } from "@/lib/score";
import { deriveIssues, type Issue } from "@/lib/issues";

type AnalyzeReport = {
  domain: string;
  score: AggregatedScore;
  issues: Issue[];
  checkedAt: string;
};

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

/**
 * Rejects hosts that would make this server-side fetch an SSRF vector:
 * loopback, link-local (includes the cloud metadata endpoint at
 * 169.254.169.254) and private ranges. Best-effort on the literal
 * hostname/IP the user typed — it doesn't resolve DNS, so a domain
 * that resolves to a private IP at request time isn't caught here.
 */
function isBlockedHost(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) return true;

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return (
    a === 127 ||
    a === 10 ||
    a === 169 && b === 254 ||
    a === 192 && b === 168 ||
    a === 172 && b >= 16 && b <= 31
  );
}

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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";

  if (!rawUrl) {
    return NextResponse.json({ error: "Informe uma URL." }, { status: 400 });
  }

  const targetUrl = parseTargetUrl(rawUrl);
  if (!targetUrl) {
    return NextResponse.json({ error: "URL inválida." }, { status: 400 });
  }

  const domain = targetUrl.hostname;

  const cached = getCached<AnalyzeReport>(domain);
  if (cached) {
    return NextResponse.json(cached);
  }

  const target = targetUrl.toString();

  let https, metaTags, altImages, sitemapRobots, pagespeed;
  try {
    [https, metaTags, altImages, sitemapRobots, pagespeed] = await Promise.all([
      checkHttps(target),
      checkMetaTags(target),
      checkAltImages(target),
      checkSitemapRobots(target),
      runPageSpeed(target),
    ]);
  } catch (error) {
    return NextResponse.json(
      { error: `Não foi possível analisar o site: ${(error as Error).message}` },
      { status: 502 },
    );
  }

  const score = aggregateScore({ pagespeed, https, metaTags, altImages, sitemapRobots });
  const issues = deriveIssues({ pagespeed, https, metaTags, altImages, sitemapRobots });

  const report: AnalyzeReport = {
    domain,
    score,
    issues,
    checkedAt: new Date().toISOString(),
  };

  setCached(domain, report);

  return NextResponse.json(report);
}
