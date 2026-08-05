import { safeFetch } from "./safeFetch";
import { normalizeUrl } from "./url";
import { CHECK_TIMEOUT_MS } from "./timeouts";

/**
 * Fetches a page's HTML once. checkMetaTags and checkAltImages used to
 * each independently re-fetch the exact same URL — tripling traffic
 * against the (third-party) site being analyzed, tripling the chance
 * of hitting its rate limit or bot-blocking, and tripling the latency
 * this check contributes to the report. They now both parse the one
 * response this returns.
 *
 * Not used by checkHttps: that check deliberately starts from
 * http://, not https://, to test whether the request gets upgraded —
 * a different request than "fetch the page," not an optimization
 * target here.
 */
export async function fetchHtml(url: string, signal?: AbortSignal): Promise<string> {
  const requestedUrl = normalizeUrl(url);
  const timeout = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  const response = await safeFetch(requestedUrl, {
    method: "GET",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  return response.text();
}
