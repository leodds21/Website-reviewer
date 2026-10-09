import { readTextCapped, safeFetch } from "../safeFetch";
import { normalizeUrl } from "../url";
import { CHECK_TIMEOUT_MS } from "../timeouts";
import { HttpStatusError, UnreachableError, isBotBlockStatus } from "../httpStatus";

export type SitemapRobotsCheckResult = {
  // null means we couldn't tell, not that the file is missing.
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

// A firewall 403 isn't "file missing"; blockedStatus says why we don't know.
type ProbeResult = { found: boolean | null; blockedStatus?: number };

async function robotsTxtExistsAt(url: string, signal?: AbortSignal): Promise<ProbeResult> {
  try {
    const response = await fetchWithTimeout(url, signal);
    await response.body?.cancel();
    if (isBotBlockStatus(response.status)) return { found: null, blockedStatus: response.status };
    return { found: response.ok };
  } catch {
    return { found: null };
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

// GET, not HEAD: some hosts handle HEAD badly for static files. Throws
// when neither probe reached the host, instead of reporting both missing.
export async function checkSitemapRobots(url: string, signal?: AbortSignal): Promise<SitemapRobotsCheckResult> {
  const requestedUrl = normalizeUrl(url);
  const origin = new URL(requestedUrl).origin;

  const [sitemap, robots] = await Promise.all([
    sitemapExistsAt(`${origin}/sitemap.xml`, signal),
    robotsTxtExistsAt(`${origin}/robots.txt`, signal),
  ]);

  if (sitemap.found === null && robots.found === null) {
    const blockedStatus = sitemap.blockedStatus ?? robots.blockedStatus;
    if (blockedStatus !== undefined) {
      throw new HttpStatusError(blockedStatus, `Origin refused the check: ${origin} answered ${blockedStatus}`);
    }
    throw new UnreachableError(`Origin unreachable: ${origin}`);
  }

  return { hasSitemap: sitemap.found, hasRobotsTxt: robots.found };
}
