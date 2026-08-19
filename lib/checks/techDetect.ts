export type TechPlatform = "wordpress" | "wix" | "squarespace" | "shopify";

export type TechDetectResult = {
  platform: TechPlatform | null;
};

// Presence-only signatures pulled from each platform's own markup —
// deliberately not trying to tell a well-maintained site from a
// neglected one (that would need a lot more than a regex over the
// homepage), just naming what the site runs on. First match wins;
// order doesn't matter in practice since these signatures don't
// overlap with each other.
const SIGNATURES: { platform: TechPlatform; pattern: RegExp }[] = [
  { platform: "wordpress", pattern: /wp-content|wp-includes|<meta[^>]+name=["']generator["'][^>]+content=["']WordPress/i },
  { platform: "wix", pattern: /static\.wixstatic\.com|<meta[^>]+name=["']generator["'][^>]+content=["']Wix\.com/i },
  { platform: "squarespace", pattern: /static1\.squarespace\.com|<meta[^>]+name=["']generator["'][^>]+content=["']Squarespace/i },
  { platform: "shopify", pattern: /cdn\.shopify\.com|Shopify\.theme/i },
];

/**
 * Names the site-building platform, if any of a handful of well-known
 * ones left a trace in the already-fetched HTML — a pure parser, same
 * shape as parseMetaTags/parseAltImages, no fetch of its own. Not a
 * finding: which platform a site runs on isn't a problem to fix, so
 * this feeds a neutral report field, not lib/issues.ts.
 */
export function detectTech(html: string): TechDetectResult {
  const match = SIGNATURES.find((signature) => signature.pattern.test(html));
  return { platform: match?.platform ?? null };
}
