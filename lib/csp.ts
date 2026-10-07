// React/Next's dev-mode tooling (component stack reconstruction, Fast
// Refresh) calls eval() — never in a production build, only in local
// development, where without it `npm run dev` can't run at all.
const isDev = process.env.NODE_ENV !== "production";

/**
 * The app's Content-Security-Policy, in one place for both of its uses.
 *
 * With a nonce (the page itself, set per request by proxy.ts): scripts
 * run only if they carry that request's nonce, which Next adds to its
 * own scripts automatically, and whatever they load ('strict-dynamic').
 * An injected <script> can't guess it, so 'unsafe-inline' is gone.
 * Without one (everything else: images, robots.txt, errors), the
 * static fallback still allows inline scripts, since there's no
 * per-request render there to stamp a nonce on.
 *
 * style-src keeps 'unsafe-inline' either way: several components set
 * real inline `style` attributes (the progress bar's width, the scan's
 * animation delays), and a nonce doesn't cover style attributes. That's
 * a far smaller risk than inline script.
 */
export function contentSecurityPolicy(nonce?: string): string {
  const scripts = nonce ? `'self' 'nonce-${nonce}' 'strict-dynamic'` : "'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    `script-src ${scripts}${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    // The contact form posts to Formspree straight from the browser;
    // without it here the CSP would silently break every submission.
    // ws:/wss: only in dev, for Fast Refresh's hot-reload websocket.
    `connect-src 'self' https://formspree.io${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
