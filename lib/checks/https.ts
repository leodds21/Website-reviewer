import { safeFetch } from "../safeFetch";
import { normalizeUrl } from "../url";
import { CHECK_TIMEOUT_MS } from "../timeouts";

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
export async function checkHttps(url: string, signal?: AbortSignal): Promise<HttpsCheckResult> {
  const requestedUrl = normalizeUrl(url, "http");
  const timeout = AbortSignal.timeout(CHECK_TIMEOUT_MS);

  try {
    const response = await safeFetch(requestedUrl, {
      method: "GET",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });

    // Only the final URL and the headers matter here — leaving the body
    // unread would hold the connection open in undici's pool until GC.
    await response.body?.cancel();

    const finalUrl = response.url;

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
