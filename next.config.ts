import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./lib/csp";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Not the page itself: proxy.ts sets its CSP with a nonce.
        source: "/:path+",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy() }],
      },
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
