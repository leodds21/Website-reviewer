/**
 * Prepends a default scheme when the input has none. Used to be copied
 * inline, slightly differently, in five different files (four of them
 * defaulting to https, one — checkHttps, deliberately — to http, since
 * its whole job is testing whether a plain-http request gets upgraded).
 * One helper, one behavior to reason about.
 */
export function normalizeUrl(input: string, defaultScheme: "http" | "https" = "https"): string {
  return input.startsWith("http://") || input.startsWith("https://") ? input : `${defaultScheme}://${input}`;
}
