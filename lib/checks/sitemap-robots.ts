import { safeFetch } from "../safeFetch";
import { normalizeUrl } from "../url";

export type SitemapRobotsCheckResult = {
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
};

async function existsAt(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const timeout = AbortSignal.timeout(8000);
    const response = await safeFetch(url, {
      method: "GET",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    return response.ok;
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
    existsAt(`${origin}/sitemap.xml`, signal),
    existsAt(`${origin}/robots.txt`, signal),
  ]);

  return { hasSitemap, hasRobotsTxt };
}
