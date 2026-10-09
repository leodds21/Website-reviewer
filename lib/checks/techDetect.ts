export type TechPlatform = "wordpress" | "wix" | "squarespace" | "shopify";

export type TechDetectResult = {
  platform: TechPlatform | null;
};

const SIGNATURES: { platform: TechPlatform; pattern: RegExp }[] = [
  { platform: "wordpress", pattern: /wp-content|wp-includes|<meta[^>]+name=["']generator["'][^>]+content=["']WordPress/i },
  { platform: "wix", pattern: /static\.wixstatic\.com|<meta[^>]+name=["']generator["'][^>]+content=["']Wix\.com/i },
  { platform: "squarespace", pattern: /static1\.squarespace\.com|<meta[^>]+name=["']generator["'][^>]+content=["']Squarespace/i },
  { platform: "shopify", pattern: /cdn\.shopify\.com|Shopify\.theme/i },
];

// Informational only: the platform isn't a finding.
export function detectTech(html: string): TechDetectResult {
  const match = SIGNATURES.find((signature) => signature.pattern.test(html));
  return { platform: match?.platform ?? null };
}
