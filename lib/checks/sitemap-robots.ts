import { safeFetch } from "../safeFetch";

export type SitemapRobotsCheckResult = {
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
};

async function existsAt(url: string): Promise<boolean> {
  try {
    const response = await safeFetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
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
export async function checkSitemapRobots(url: string): Promise<SitemapRobotsCheckResult> {
  const requestedUrl = url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;

  const origin = new URL(requestedUrl).origin;

  const [hasSitemap, hasRobotsTxt] = await Promise.all([
    existsAt(`${origin}/sitemap.xml`),
    existsAt(`${origin}/robots.txt`),
  ]);

  return { hasSitemap, hasRobotsTxt };
}
