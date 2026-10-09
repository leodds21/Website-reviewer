import { safeFetch } from "../safeFetch";
import { normalizeUrl } from "../url";
import { CHECK_TIMEOUT_MS } from "../timeouts";
import { HttpStatusError, isBotBlockStatus } from "../httpStatus";

export type HttpsCheckResult = {
  passed: boolean;
  finalUrl: string;
  redirectedFromHttp: boolean;
  // TLS is served but the chain isn't trusted (often a missing intermediate).
  certificateError?: boolean;
  // Both http:// and https:// work, but http:// doesn't redirect.
  noHttpRedirect?: boolean;
  // Reused by parseSecurityHeaders, so the page isn't fetched twice.
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

async function fetchFinal(url: string, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  const response = await safeFetch(url, {
    method: "GET",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  // Only the URL and headers matter; an unread body holds the connection.
  await response.body?.cancel();
  return response;
}

type HttpsAttempt = { response: Response } | { certificateError: true; url: string } | { unreachable: true; url: string };

async function tryHttps(httpUrl: string, signal?: AbortSignal): Promise<HttpsAttempt> {
  const httpsUrl = new URL(httpUrl);
  httpsUrl.protocol = "https:";
  try {
    return { response: await fetchFinal(httpsUrl.toString(), signal) };
  } catch (error) {
    if (isCertificateError(error)) return { certificateError: true, url: httpsUrl.toString() };
    if (signal?.aborted) throw error;
    return { unreachable: true, url: httpsUrl.toString() };
  }
}

// http:// was refused (a firewall 403), so ask https:// directly. Any
// answer over trusted TLS proves the site serves HTTPS.
async function checkHttpsDirectly(httpUrl: string, refusedStatus: number, signal?: AbortSignal): Promise<HttpsCheckResult> {
  const attempt = await tryHttps(httpUrl, signal);
  if ("certificateError" in attempt) {
    return { passed: false, finalUrl: attempt.url, redirectedFromHttp: false, certificateError: true };
  }
  if ("unreachable" in attempt) {
    // We can't tell either way, so no verdict.
    throw new HttpStatusError(refusedStatus, `HTTP refused (${refusedStatus}) and HTTPS unreachable: ${new URL(attempt.url).host}`);
  }

  return {
    passed: attempt.response.url.startsWith("https://"),
    finalUrl: attempt.response.url,
    redirectedFromHttp: false,
    headers: attempt.response.headers,
  };
}

// http:// answered without redirecting. Many sites serve both
// (example.com does), so check https:// before calling it "no HTTPS".
async function checkHttpsAlongside(httpResponse: Response, signal?: AbortSignal): Promise<HttpsCheckResult> {
  const attempt = await tryHttps(httpResponse.url, signal);
  if ("certificateError" in attempt) {
    return { passed: false, finalUrl: attempt.url, redirectedFromHttp: false, certificateError: true };
  }
  if ("unreachable" in attempt || !attempt.response.url.startsWith("https://")) {
    return { passed: false, finalUrl: httpResponse.url, redirectedFromHttp: false, headers: httpResponse.headers };
  }

  // The https:// headers: HSTS and the rest only mean anything there.
  return {
    passed: true,
    finalUrl: attempt.response.url,
    redirectedFromHttp: false,
    noHttpRedirect: true,
    headers: attempt.response.headers,
  };
}

// Starts at http://, unlike the other checks, to see whether the site upgrades.
export async function checkHttps(url: string, signal?: AbortSignal): Promise<HttpsCheckResult> {
  const requestedUrl = normalizeUrl(url, "http");

  try {
    const response = await fetchFinal(requestedUrl, signal);
    const finalUrl = response.url;

    if (finalUrl.startsWith("http://")) {
      return isBotBlockStatus(response.status)
        ? await checkHttpsDirectly(finalUrl, response.status, signal)
        : await checkHttpsAlongside(response, signal);
    }

    return {
      passed: finalUrl.startsWith("https://"),
      finalUrl,
      redirectedFromHttp: requestedUrl.startsWith("http://") && finalUrl.startsWith("https://"),
      headers: response.headers,
    };
  } catch (error) {
    // A broken certificate chain is a finding, not a failed check.
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
