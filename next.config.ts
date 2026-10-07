import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./lib/csp";

const nextConfig: NextConfig = {
  // Stop advertising the framework/version for free — the same
  // information-disclosure category as a server banner.
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Every path but the page itself: proxy.ts sets the page's CSP,
        // with a fresh script nonce per request (see lib/csp.ts).
        source: "/:path+",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy() }],
      },
      {
        source: "/(.*)",
        headers: [
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
