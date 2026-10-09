import { readTextCapped, safeFetch } from "../safeFetch";
import { normalizeUrl } from "../url";
import { CHECK_TIMEOUT_MS } from "../timeouts";
import { HttpStatusError, UnreachableError, isBotBlockStatus } from "../httpStatus";

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

// found is null whenever we don't actually know: the request never
// completed, or the server refused an automated client (a 403 from a
// firewall is not "this file doesn't exist"). blockedStatus remembers
// the refusal so the caller can say *why* it doesn't know.
type ProbeResult = { found: boolean | null; blockedStatus?: number };

async function robotsTxtExistsAt(url: string, signal?: AbortSignal): Promise<ProbeResult> {
  try {
    const response = await fetchWithTimeout(url, signal);
    await response.body?.cancel(); // status is all we need, never read the body
    if (isBotBlockStatus(response.status)) return { found: null, blockedStatus: response.status };
    return { found: response.ok };
  } catch {
    // The request never completed (DNS failure, refused connection,
    // TLS error, timeout). The server didn't tell us the file is
    // missing — we simply don't know.
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
    // Many hosts respond 200 with an HTML "not found" page instead of
    // a real 404 for a missing sitemap — a bare status check reports
    // "found" for a sitemap that doesn't actually exist. A real one
    // starts with an XML declaration or one of its two root elements.
    // Only the first bytes matter — the root element is all this
    // checks, so there's no reason to pull a large sitemap into memory.
    const text = await readTextCapped(response, 1024);
    return { found: /^\s*(<\?xml|<urlset|<sitemapindex)/i.test(text) };
  } catch {
    return { found: null };
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
