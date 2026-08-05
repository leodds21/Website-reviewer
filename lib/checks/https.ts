import { safeFetch } from "../safeFetch";

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
 */
export async function checkHttps(url: string): Promise<HttpsCheckResult> {
  const requestedUrl = url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `http://${url}`;

  try {
    const response = await safeFetch(requestedUrl, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });

    const finalUrl = response.url;

    return {
      passed: finalUrl.startsWith("https://"),
      finalUrl,
      redirectedFromHttp: requestedUrl.startsWith("http://") && finalUrl.startsWith("https://"),
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
