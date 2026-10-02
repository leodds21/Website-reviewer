import { safeFetch } from "../safeFetch";
import { LINK_CHECK_TIMEOUT_MS } from "../timeouts";

// A conservative cap, not an exhaustive crawl: this fires one request
// per sampled link, concurrently, against the site being analyzed —
// checking every link on a large page would multiply the traffic this
// report generates against a third party many times over, for a report
// that's only ever meant to look at the home page.
const MAX_LINKS_SAMPLED = 10;

const HREF_PATTERN = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;

export type BrokenLinksCheckResult = {
  // How many of the sampled links we actually got a real answer for —
  // distinct from how many <a href> tags exist on the page. A link
  // whose check timed out or failed to connect contributes to neither
  // this nor brokenCount (see isReachable below).
  checkedCount: number;
  brokenCount: number;
  brokenUrls: string[];
};

// Pulls unique, checkable link targets out of the page's own markup —
// same regex-over-HTML approach as parseMetaTags/parseAltImages, no
// DOM parser. Resolves each href against the page's own URL so
// relative links ("/sobre") become checkable absolute ones.
function extractLinkUrls(html: string, baseUrl: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const match of html.matchAll(HREF_PATTERN)) {
    if (urls.length >= MAX_LINKS_SAMPLED) break;

    const raw = match[1].trim();
    if (!raw || raw.startsWith("#")) continue;
    if (/^(mailto|tel|javascript):/i.test(raw)) continue;

    let resolved: URL;
    try {
      resolved = new URL(raw, baseUrl);
    } catch {
      continue; // malformed href in the site's own markup — not ours to flag here
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;

    resolved.hash = ""; // #section vs the plain link is the same request
    const key = resolved.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(key);
  }

  return urls;
}

// Statuses a live page returns to an automated client it doesn't want
// (login walls, bot protection, rate limits; 999 is LinkedIn's own).
// They say nothing about whether the link works for a real visitor.
const BOT_BLOCK_STATUSES = new Set([401, 403, 429, 999]);

// true/false only when the request actually got a usable answer — a
// network failure (DNS, timeout, connection refused) or a bot-block
// response means we don't know whether the link works, so it comes
// back null rather than a guess in either direction (same rule as
// sitemapRobots.ts's probes, for the same reason: a "false" born from
// a request that never got a real answer would read as a
// confirmed-broken link, e.g. a perfectly good LinkedIn profile).
async function isReachable(url: string, signal?: AbortSignal): Promise<boolean | null> {
  const timeout = AbortSignal.timeout(LINK_CHECK_TIMEOUT_MS);
  try {
    const response = await safeFetch(url, {
      method: "GET",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    await response.body?.cancel().catch(() => {});
    if (BOT_BLOCK_STATUSES.has(response.status)) return null;
    return response.status < 400;
  } catch {
    return null;
  }
}

/**
 * Samples up to MAX_LINKS_SAMPLED links from the home page's own
 * markup and checks each concurrently for a broken (4xx/5xx, or
 * unreachable) response. Throws when every sampled link came back
 * unreachable — same shape as checkSitemapRobots's guard: with zero
 * real answers, reporting "0 broken" would be indistinguishable from
 * an honest all-clear, when in fact nothing was actually verified
 * (most likely our own network path to the site is down, not that
 * every single link happens to work).
 */
export async function checkBrokenLinks(html: string, baseUrl: string, signal?: AbortSignal): Promise<BrokenLinksCheckResult> {
  const urls = extractLinkUrls(html, baseUrl);
  const results = await Promise.all(urls.map((url) => isReachable(url, signal)));

  if (urls.length > 0 && results.every((reachable) => reachable === null)) {
    throw new Error(`Nenhum dos ${urls.length} links amostrados pôde ser verificado.`);
  }

  const brokenUrls = urls.filter((_, index) => results[index] === false);
  const checkedCount = results.filter((reachable) => reachable !== null).length;

  return {
    checkedCount,
    brokenCount: brokenUrls.length,
    brokenUrls,
  };
}
