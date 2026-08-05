import { safeFetch } from "../safeFetch";
import { normalizeUrl } from "../url";
import { CHECK_TIMEOUT_MS } from "../timeouts";

export type SitemapRobotsCheckResult = {
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
};

async function fetchWithTimeout(url: string, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  return safeFetch(url, {
    method: "GET",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
}

async function robotsTxtExistsAt(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(url, signal);
    await response.body?.cancel(); // status is all we need, never read the body
    return response.ok;
  } catch {
    return false;
  }
}

async function sitemapExistsAt(url: string, signal?: AbortSignal): Promise<boolean> {
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
    const text = await response.text();
    return /^\s*(<\?xml|<urlset|<sitemapindex)/i.test(text);
  } catch {
    return false;
  }
}

/**
 * Checks for /sitemap.xml and /robots.txt at the domain root. A HEAD
 * request would be cheaper, but some hosts don't implement HEAD
 * correctly for static files, so GET is more reliable here.
 */
export async function checkSitemapRobots(url: string, signal?: AbortSignal): Promise<SitemapRobotsCheckResult> {
  const requestedUrl = normalizeUrl(url);
  const origin = new URL(requestedUrl).origin;

  const [hasSitemap, hasRobotsTxt] = await Promise.all([
    sitemapExistsAt(`${origin}/sitemap.xml`, signal),
    robotsTxtExistsAt(`${origin}/robots.txt`, signal),
  ]);

  return { hasSitemap, hasRobotsTxt };
}
