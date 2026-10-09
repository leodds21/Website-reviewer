import { safeFetch } from "../safeFetch";
import { LINK_CHECK_TIMEOUT_MS } from "../timeouts";
import { UnreachableError, isBotBlockStatus } from "../httpStatus";

// One request per link against someone else's site, so keep the sample small.
const MAX_LINKS_SAMPLED = 10;

const HREF_PATTERN = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;

export type BrokenLinksCheckResult = {
  // Links that got a real answer; timeouts and bot blocks count in neither field.
  checkedCount: number;
  brokenCount: number;
  brokenUrls: string[];
};

function extractLinkUrls(html: string, baseUrl: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const match of html.matchAll(HREF_PATTERN)) {
    if (urls.length >= MAX_LINKS_SAMPLED) break;

    // "&amp;" in an attribute means "&"; requesting it literally can 404.
    const raw = match[1].trim().replace(/&amp;/gi, "&");
    if (!raw || raw.startsWith("#")) continue;
    if (/^(mailto|tel|javascript):/i.test(raw)) continue;

    let resolved: URL;
    try {
      resolved = new URL(raw, baseUrl);
    } catch {
      continue;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;

    resolved.hash = "";
    const key = resolved.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(key);
  }

  return urls;
}

// null when we got no usable answer, so a blocked LinkedIn link isn't called broken.
async function isReachable(url: string, signal?: AbortSignal): Promise<boolean | null> {
  const timeout = AbortSignal.timeout(LINK_CHECK_TIMEOUT_MS);
  try {
    const response = await safeFetch(url, {
      method: "GET",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    await response.body?.cancel().catch(() => {});
    if (isBotBlockStatus(response.status)) return null;
    return response.status < 400;
  } catch {
    return null;
  }
}

// Throws when no link could be verified: "0 broken" would read as an all-clear.
export async function checkBrokenLinks(html: string, baseUrl: string, signal?: AbortSignal): Promise<BrokenLinksCheckResult> {
  const urls = extractLinkUrls(html, baseUrl);
  const results = await Promise.all(urls.map((url) => isReachable(url, signal)));

  if (urls.length > 0 && results.every((reachable) => reachable === null)) {
    throw new UnreachableError(`None of the ${urls.length} sampled links could be verified.`);
  }

  const brokenUrls = urls.filter((_, index) => results[index] === false);
  const checkedCount = results.filter((reachable) => reachable !== null).length;

  return {
    checkedCount,
    brokenCount: brokenUrls.length,
    brokenUrls,
  };
}
