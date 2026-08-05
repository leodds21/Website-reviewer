import { safeFetch } from "../safeFetch";

export type HttpsCheckResult = {
  passed: boolean;
  finalUrl: string;
  redirectedFromHttp: boolean;
};

/**
 * Checks whether a site serves over HTTPS, following redirects (e.g. a
 * plain-HTTP request that the server bounces to HTTPS still counts as
 * passing — what matters is where the request actually lands).
 */
export async function checkHttps(url: string): Promise<HttpsCheckResult> {
  const requestedUrl = url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `http://${url}`;

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
}
