import { openingTags, tokens, withoutComments } from "./html";

export type FaviconCheckResult = {
  // A <link rel="icon">; /favicon.ico is probed separately (sitemapRobots).
  hasIconLink: boolean;
};

export function parseFavicon(html: string): FaviconCheckResult {
  const hasIconLink = openingTags(withoutComments(html), "link").some((tag) => {
    const rel = tokens(tag, "rel");
    return rel.includes("icon") || rel.includes("apple-touch-icon");
  });
  return { hasIconLink };
}
