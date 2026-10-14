import { readTextCapped, safeFetch } from "../safeFetch";
import { normalizeUrl } from "../url";
import { CHECK_TIMEOUT_MS } from "../timeouts";
import { HttpStatusError, UnreachableError, isBotBlockStatus } from "../httpStatus";
import { blocksGooglebot } from "./robotsTxt";

export type SitemapRobotsCheckResult = {
  // null means we couldn't tell, not that the file is missing.
  hasSitemap: boolean | null;
  hasRobotsTxt: boolean | null;
  // Whether robots.txt keeps Googlebot off the analyzed path.
  blocksGooglebot: boolean | null;
  hasFaviconIco: boolean | null;
};

// Google reads the first 500 KiB of a robots.txt and ignores the rest.
const ROBOTS_TXT_MAX_BYTES = 500 * 1024;

async function fetchWithTimeout(url: string, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  return safeFetch(url, {
    method: "GET",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
}

// A firewall 403 isn't "file missing"; blockedStatus says why we don't know.
type ProbeResult = { found: boolean | null; blockedStatus?: number };

async function robotsTxtAt(url: string, path: string, signal?: AbortSignal): Promise<ProbeResult & { blocksGooglebot: boolean | null }> {
  try {
    const response = await fetchWithTimeout(url, signal);
    if (isBotBlockStatus(response.status)) {
      await response.body?.cancel();
      return { found: null, blockedStatus: response.status, blocksGooglebot: null };
    }
    if (!response.ok) {
      await response.body?.cancel();
      // Google treats a missing robots.txt as "crawl everything"; a 5xx as "crawl nothing for now".
      return { found: false, blocksGooglebot: response.status < 500 ? false : null };
    }
    const text = await readTextCapped(response, ROBOTS_TXT_MAX_BYTES);
    // An HTML "not found" page answered with 200 has no rules.
    const html = /^\s*</.test(text);
    return { found: true, blocksGooglebot: html ? false : blocksGooglebot(text, path) };
  } catch {
    return { found: null, blocksGooglebot: null };
  }
}

async function sitemapExistsAt(url: string, signal?: AbortSignal): Promise<ProbeResult> {
  try {
    const response = await fetchWithTimeout(url, signal);
    if (!response.ok) {
      await response.body?.cancel();
      if (isBotBlockStatus(response.status)) return { found: null, blockedStatus: response.status };
      return { found: false };
    }
    // Many hosts answer 200 with an HTML "not found" page, so check the root element.
    const text = await readTextCapped(response, 1024);
    return { found: /^\s*(<\?xml|<urlset|<sitemapindex)/i.test(text) };
  } catch {
    return { found: null };
  }
}

async function faviconExistsAt(url: string, signal?: AbortSignal): Promise<ProbeResult> {
  try {
    const response = await fetchWithTimeout(url, signal);
    await response.body?.cancel();
    if (isBotBlockStatus(response.status)) return { found: null, blockedStatus: response.status };
    // Same soft-404 trap as the sitemap: an HTML page isn't an icon.
    const type = response.headers.get("content-type") ?? "";
    return { found: response.ok && /^(image\/|application\/octet-stream)/i.test(type) };
  } catch {
    return { found: null };
  }
}

// GET, not HEAD: some hosts handle HEAD badly for static files. Throws
// when no probe reached the host, instead of reporting everything missing.
export async function checkSitemapRobots(url: string, signal?: AbortSignal): Promise<SitemapRobotsCheckResult> {
  const requestedUrl = new URL(normalizeUrl(url));
  const origin = requestedUrl.origin;

  const [sitemap, robots, favicon] = await Promise.all([
    sitemapExistsAt(`${origin}/sitemap.xml`, signal),
    robotsTxtAt(`${origin}/robots.txt`, requestedUrl.pathname + requestedUrl.search, signal),
    faviconExistsAt(`${origin}/favicon.ico`, signal),
  ]);

  if (sitemap.found === null && robots.found === null && favicon.found === null) {
    const blockedStatus = sitemap.blockedStatus ?? robots.blockedStatus ?? favicon.blockedStatus;
    if (blockedStatus !== undefined) {
      throw new HttpStatusError(blockedStatus, `Origin refused the check: ${origin} answered ${blockedStatus}`);
    }
    throw new UnreachableError(`Origin unreachable: ${origin}`);
  }

  return { hasSitemap: sitemap.found, hasRobotsTxt: robots.found, blocksGooglebot: robots.blocksGooglebot, hasFaviconIco: favicon.found };
}
