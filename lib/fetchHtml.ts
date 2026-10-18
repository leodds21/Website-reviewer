import { readTextCapped, safeFetch } from "./safeFetch";
import { normalizeUrl } from "./url";
import { CHECK_TIMEOUT_MS } from "./timeouts";
import { HttpStatusError } from "./httpStatus";

// finalUrl: where redirects ended. Relative links resolve against it, not the address asked for.
export type FetchedPage = { html: string; headers: Headers; finalUrl: string };

// Fetched once and shared by all the HTML parsers. The headers carry
// X-Robots-Tag and the CSP, which the parsers read alongside the markup.
export async function fetchHtml(url: string, signal?: AbortSignal): Promise<FetchedPage> {
  const requestedUrl = normalizeUrl(url);
  const timeout = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  const response = await safeFetch(requestedUrl, {
    method: "GET",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });

  // An error page isn't the real markup; parsing it would invent findings.
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpStatusError(response.status, `The page answered ${response.status}.`);
  }

  return { html: await readTextCapped(response), headers: response.headers, finalUrl: response.url || requestedUrl };
}
