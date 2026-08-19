export type SecurityHeadersCheckResult = {
  hasHsts: boolean;
  hasCsp: boolean;
  // True when either a dedicated X-Frame-Options header is present, or
  // the CSP already covers the same ground via frame-ancestors — the
  // modern replacement for X-Frame-Options, so a site shouldn't be
  // flagged for lacking the older header if the newer one already does
  // the job.
  hasClickjackingProtection: boolean;
};

/**
 * Reads security-relevant response headers already fetched by
 * checkHttps — no request of its own. Only meaningful once a site is
 * actually serving HTTPS (that's why callers gate this on
 * https.passed): HSTS/CSP/frame protections on a plain-HTTP response
 * don't mean what they'd mean on a secure connection.
 */
export function parseSecurityHeaders(headers: Headers): SecurityHeadersCheckResult {
  const csp = headers.get("content-security-policy");

  return {
    hasHsts: headers.has("strict-transport-security"),
    hasCsp: Boolean(csp),
    hasClickjackingProtection: headers.has("x-frame-options") || Boolean(csp && /frame-ancestors/i.test(csp)),
  };
}
