import { safeFetch } from "../safeFetch";
import { normalizeUrl } from "../url";
import { CHECK_TIMEOUT_MS } from "../timeouts";
import { HttpStatusError, isBotBlockStatus } from "../httpStatus";

export type HttpsCheckResult = {
  passed: boolean;
  finalUrl: string;
  redirectedFromHttp: boolean;
  // True when the connection failed specifically because the
  // certificate chain isn't trustworthy (expired, self-signed, or —
  // the common real-world case — the server not sending its
  // intermediate certificate). Distinct from "no-https": the site
  // does serve TLS, it's just not one a client should trust.
  certificateError?: boolean;
  // Present whenever the request actually got a response — lets
  // parseSecurityHeaders (lib/checks/securityHeaders.ts) read HSTS/
  // CSP/frame protections off the same fetch instead of requesting
  // the page again just for its headers.
  headers?: Headers;
};

const CERTIFICATE_ERROR_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "CERT_UNTRUSTED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

function isCertificateError(error: unknown): boolean {
  const cause = error instanceof Error ? (error.cause as { code?: string } | undefined) : undefined;
  return Boolean(cause?.code && CERTIFICATE_ERROR_CODES.has(cause.code));
}

/**
 * Checks whether a site serves over HTTPS, following redirects (e.g. a
 * plain-HTTP request that the server bounces to HTTPS still counts as
 * passing — what matters is where the request actually lands).
 * Deliberately defaults to http://, unlike every other check — this is
 * the one place that needs to start unencrypted to see whether the
 * site upgrades the connection itself.
 */
async function fetchFinal(url: string, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  const response = await safeFetch(url, {
    method: "GET",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  // Only the final URL and the headers matter here — leaving the body
  // unread would hold the connection open in undici's pool until GC.
  await response.body?.cancel();
  return response;
}

/**
 * The plain-http request was refused (a firewall answering 403 before
 * any redirect), so it can't tell us whether the site upgrades to
 * HTTPS. Asks https:// directly instead: a response of any status over
 * a trusted connection proves the site serves HTTPS. Without this, a
 * site with HTTPS and HSTS got a critical "no HTTPS" finding.
 */
async function checkHttpsDirectly(httpUrl: string, refusedStatus: number, signal?: AbortSignal): Promise<HttpsCheckResult> {
  const httpsUrl = new URL(httpUrl);
  httpsUrl.protocol = "https:";

  let response: Response;
  try {
    response = await fetchFinal(httpsUrl.toString(), signal);
  } catch (error) {
    if (isCertificateError(error)) {
      return { passed: false, finalUrl: httpsUrl.toString(), redirectedFromHttp: false, certificateError: true };
    }
    // Refused over http and unreachable over https: we genuinely don't
    // know, so no verdict rather than a "no HTTPS" guess.
    throw new HttpStatusError(refusedStatus, `HTTP recusado (${refusedStatus}) e HTTPS inacessível: ${httpsUrl.host}`);
  }

  return {
    passed: response.url.startsWith("https://"),
    finalUrl: response.url,
    redirectedFromHttp: false,
    headers: response.headers,
  };
}

export async function checkHttps(url: string, signal?: AbortSignal): Promise<HttpsCheckResult> {
  const requestedUrl = normalizeUrl(url, "http");

  try {
    const response = await fetchFinal(requestedUrl, signal);
    const finalUrl = response.url;

    if (finalUrl.startsWith("http://") && isBotBlockStatus(response.status)) {
      return await checkHttpsDirectly(finalUrl, response.status, signal);
    }

    return {
      passed: finalUrl.startsWith("https://"),
      finalUrl,
      redirectedFromHttp: requestedUrl.startsWith("http://") && finalUrl.startsWith("https://"),
      headers: response.headers,
    };
  } catch (error) {
    // A broken certificate chain is itself a real, reportable finding —
    // not a reason to give up on checking HTTPS at all. Node's fetch
    // correctly refuses the connection (unlike a browser, which quietly
    // fetches the missing intermediate cert for you), so this is a
    // recoverable, meaningful result rather than a generic failure.
    if (isCertificateError(error)) {
      return {
        passed: false,
        finalUrl: requestedUrl,
        redirectedFromHttp: false,
        certificateError: true,
      };
    }
    throw error;
  }
}
