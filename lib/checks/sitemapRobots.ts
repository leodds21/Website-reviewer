import { readTextCapped, safeFetch } from "../safeFetch";
import { normalizeUrl } from "../url";
import { CHECK_TIMEOUT_MS } from "../timeouts";

export type SitemapRobotsCheckResult = {
  // null means "we couldn't determine this", never "it's missing" — a
  // request that never reached the server says nothing about whether
  // the file exists. Same convention as the rest of the project: a
  // measurement we don't have is null, not a fabricated negative.
  hasSitemap: boolean | null;
  hasRobotsTxt: boolean | null;
};

async function fetchWithTimeout(url: string, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  return safeFetch(url, {
    method: "GET",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
}

async function robotsTxtExistsAt(url: string, signal?: AbortSignal): Promise<boolean | null> {
  try {
    const response = await fetchWithTimeout(url, signal);
    await response.body?.cancel(); // status is all we need, never read the body
    return response.ok;
  } catch {
    // The request never completed (DNS failure, refused connection,
    // TLS error, timeout). The server didn't tell us the file is
    // missing — we simply don't know.
    return null;
  }
}

async function sitemapExistsAt(url: string, signal?: AbortSignal): Promise<boolean | null> {
  try {
    const response = await fetchWithTimeout(url, signal);
    if (!response.ok) {
      await response.body?.cancel();
      return false;
    }
    // Many hosts respond 200 with an HTML "not found" page instead of
    // a real 404 for a missing sitemap — a bare status check reports
    // "found" for a sitemap that doesn't actually exist. A real one
    // starts with an XML declaration or one of its two root elements.
    // Only the first bytes matter — the root element is all this
    // checks, so there's no reason to pull a large sitemap into memory.
    const text = await readTextCapped(response, 1024);
    return /^\s*(<\?xml|<urlset|<sitemapindex)/i.test(text);
  } catch {
    return null;
  }
}

/**
 * Checks for /sitemap.xml and /robots.txt at the domain root. A HEAD
 * request would be cheaper, but some hosts don't implement HEAD
 * correctly for static files, so GET is more reliable here.
 *
 * Throws when neither probe could reach the host at all, rather than
 * reporting both as missing. That distinction is the whole point: a
 * domain that doesn't resolve used to come back as "sitemap not found"
 * and produce a confident SEO finding about a site nobody could reach
 * — exactly the kind of fabricated verdict this project refuses to
 * make everywhere else.
 */
export async function checkSitemapRobots(url: string, signal?: AbortSignal): Promise<SitemapRobotsCheckResult> {
  const requestedUrl = normalizeUrl(url);
  const origin = new URL(requestedUrl).origin;

  const [hasSitemap, hasRobotsTxt] = await Promise.all([
    sitemapExistsAt(`${origin}/sitemap.xml`, signal),
    robotsTxtExistsAt(`${origin}/robots.txt`, signal),
  ]);

  if (hasSitemap === null && hasRobotsTxt === null) {
    throw new Error(`Origem inacessível: ${origin}`);
  }

  return { hasSitemap, hasRobotsTxt };
}
