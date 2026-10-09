// Dev tooling (Fast Refresh) needs eval(); production never does.
const isDev = process.env.NODE_ENV !== "production";

/**
 * With a nonce (pages, via proxy.ts) scripts need that nonce. Without one
 * (static responses) inline scripts are allowed, since nothing renders per request.
 * Styles keep 'unsafe-inline': nonces don't cover style attributes.
 */
export function contentSecurityPolicy(nonce?: string): string {
  const scripts = nonce ? `'self' 'nonce-${nonce}' 'strict-dynamic'` : "'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    `script-src ${scripts}${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    // The contact form posts to Formspree from the browser.
    `connect-src 'self' https://formspree.io${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
