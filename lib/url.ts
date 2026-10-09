// Any "scheme:" prefix, per RFC 3986's grammar.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// An existing scheme is kept, even an unsupported one, so "file:///etc/passwd"
// fails the protocol check instead of becoming a host named "file".
export function normalizeUrl(input: string, defaultScheme: "http" | "https" = "https"): string {
  return HAS_SCHEME.test(input) ? input : `${defaultScheme}://${input}`;
}
