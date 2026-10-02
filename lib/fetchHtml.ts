import { readTextCapped, safeFetch } from "./safeFetch";
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

  // A 403/503 here is usually a bot wall or an error page, not the
  // site's real markup. Parsing it anyway would report "no title, no
  // viewport" as confirmed findings about a page we never actually
  // saw — failing the fetch leaves those checks "indisponível", the
  // same honest answer as any other check that couldn't run.
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`A página respondeu ${response.status}.`);
  }

  return readTextCapped(response);
}
