import type { NextConfig } from "next";

// script-src/style-src allow 'unsafe-inline' deliberately: Next's own
// hydration payload ships as inline <script> tags, and several
// components here set real inline `style` attributes (the loading
// bar's width, a severity color on an error message's border) — a
// strict nonce-based CSP is the "correct" fix for the script side, but
// needs middleware to mint and thread a per-request nonce through
// every render, which is a bigger change than this pass covers.
// Everything else here is a real, meaningful restriction: no
// cross-origin scripts, no framing (the exact clickjacking protection
// this app itself checks other sites for), no data exfiltration to an
// arbitrary origin.
// React/Next's dev-mode tooling (component stack reconstruction, Fast
// Refresh) calls eval() — never in a production build, only here for
// local development. Without this, `npm run dev` throws
// "eval() is not supported... unsafe-eval" instead of actually
// running, since the CSP applies identically in both modes otherwise.
const isDev = process.env.NODE_ENV !== "production";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  // The contact form fetches this directly from the browser — without
  // it here, the CSP would silently break every submission. ws:/wss:
  // only added in dev, for Fast Refresh's hot-reload websocket.
  `connect-src 'self' https://formspree.io${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Stop advertising the framework/version for free — the same
  // information-disclosure category as a server banner.
  poweredByHeader: false,

  // The screenshot step's serverless Chromium ships as brotli archives
  // that the package reads from disk at runtime, never imports, so file
  // tracing can't see them; without this the function deploys without a
  // browser. (The package itself is already external by Next's default.)
  outputFileTracingIncludes: {
    "/api/analyze": ["./node_modules/@sparticuz/chromium/bin/**"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // Harmless to send over plain HTTP in local dev — browsers
          // only honor HSTS on a response actually served over TLS.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here uses the camera, mic, or location — an
          // explicit deny is cheap insurance against a future
          // dependency trying to prompt for one.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
