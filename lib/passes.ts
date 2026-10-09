import type { CheckResults } from "./checkResults";
import type { IssueCategory } from "./issues";

export type PassCode =
  | "https"
  | "security-headers"
  | "title"
  | "description"
  | "viewport"
  | "alt-images"
  | "sitemap"
  | "links"
  | "fast-load"
  | "stable-layout";

export type Pass = { category: IssueCategory; code: PassCode };

// Core Web Vitals "good" lines (web.dev/articles/lcp, web.dev/articles/cls).
const GOOD_LCP_SECONDS = 2.5;
const GOOD_CLS = 0.1;

// Only what was actually measured: nothing to check means no pass.
export function derivePasses(input: Partial<CheckResults>): Pass[] {
  const passes: Pass[] = [];
  const add = (category: IssueCategory, code: PassCode) => passes.push({ category, code });

  const { https, securityHeaders, metaTags, altImages, sitemapRobots, brokenLinks, pagespeed } = input;

  if (https?.passed && !https.noHttpRedirect) add("security", "https");
  if (https?.passed && securityHeaders?.hasHsts && securityHeaders.hasCsp && securityHeaders.hasClickjackingProtection) {
    add("security", "security-headers");
  }

  // Lighthouse stands in when our fetch didn't get the HTML.
  const genericTitle = metaTags?.title === "Home" || metaTags?.title === "Início";
  if (metaTags ? metaTags.hasTitle && !genericTitle : pagespeed?.hasTitle === true) add("seo", "title");
  if (metaTags ? metaTags.hasDescription : pagespeed?.hasDescription === true) add("seo", "description");
  if (metaTags ? metaTags.hasViewport : pagespeed?.hasViewport === true) add("accessibility", "viewport");

  if (altImages ? altImages.sampledCount > 0 && altImages.missingAltCount === 0 : pagespeed?.imagesHaveAlt === true) {
    add("accessibility", "alt-images");
  }

  if (sitemapRobots?.hasSitemap === true) add("seo", "sitemap");
  if (brokenLinks && brokenLinks.checkedCount > 0 && brokenLinks.brokenCount === 0) add("seo", "links");

  if (typeof pagespeed?.lcpSeconds === "number" && pagespeed.lcpSeconds <= GOOD_LCP_SECONDS) add("performance", "fast-load");
  if (typeof pagespeed?.clsValue === "number" && pagespeed.clsValue <= GOOD_CLS) add("performance", "stable-layout");

  return passes;
}
