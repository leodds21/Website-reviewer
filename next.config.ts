import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./lib/csp";

const STATIC_CSP_PATHS = ["/api/:path*", "/_next/:path*", "/_vercel/:path*", "/icon.svg", "/robots.txt", "/sitemap.xml"];

const nextConfig: NextConfig = {
  typedRoutes: true,
  poweredByHeader: false,

  async headers() {
    return [
      // Exactly the paths proxy.ts skips; it sets the page CSP, with a nonce.
      ...STATIC_CSP_PATHS.map((source) => ({
        source,
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy() }],
      })),
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
