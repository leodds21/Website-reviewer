// Used for metadataBase, robots.ts, and sitemap.ts — anywhere an
// absolute URL is required rather than a relative one. Overridable via
// env var specifically so a preview/staging deploy on a *.vercel.app
// domain doesn't advertise the production URL in its own metadata.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://isdias.dev";
