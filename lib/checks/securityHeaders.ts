export type SecurityHeadersCheckResult = {
  hasHsts: boolean;
  hasCsp: boolean;
  // X-Frame-Options or CSP frame-ancestors, its modern replacement.
  hasClickjackingProtection: boolean;
};

// Reads the headers checkHttps already fetched.
export function parseSecurityHeaders(headers: Headers): SecurityHeadersCheckResult {
  const csp = headers.get("content-security-policy");

  return {
    hasHsts: headers.has("strict-transport-security"),
    hasCsp: Boolean(csp),
    hasClickjackingProtection: headers.has("x-frame-options") || Boolean(csp && /frame-ancestors/i.test(csp)),
  };
}
