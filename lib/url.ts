/**
 * Prepends a default scheme when the input has none. Used to be copied
 * inline, slightly differently, in five different files (four of them
 * defaulting to https, one — checkHttps, deliberately — to http, since
 * its whole job is testing whether a plain-http request gets upgraded).
 * One helper, one behavior to reason about.
 */
// Any "scheme:" prefix, per RFC 3986's grammar.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeUrl(input: string, defaultScheme: "http" | "https" = "https"): string {
  // An input that already declares a scheme is left exactly as it is,
  // even an unsupported one. Blindly prefixing turned
  // "file:///etc/passwd" into "https://file///etc/passwd" — a valid URL
  // for a host named "file", which sailed past the protocol check and
  // got analyzed as if it were a real site. Left intact, it parses as
  // file: and the caller's protocol check rejects it properly.
  return HAS_SCHEME.test(input) ? input : `${defaultScheme}://${input}`;
}
