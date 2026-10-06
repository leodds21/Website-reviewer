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

// Google's "good" Core Web Vitals lines (web.dev/articles/lcp and
// web.dev/articles/cls), the same sources as the thresholds in
// lib/issues.ts: a pass has to clear "good", not just avoid "poor".
const GOOD_LCP_SECONDS = 2.5;
const GOOD_CLS = 0.1;

/**
 * What the checks found right, for the report's "o que está certo"
 * list, so a healthy site doesn't get a report that's only an empty
 * findings section. The mirror of deriveIssues, under the same rule:
 * only what was actually measured. A check that didn't run, or had
 * nothing to look at (a page with no images, no links answered), says
 * nothing here rather than a pass nobody verified.
 */
export function derivePasses(input: Partial<CheckResults>): Pass[] {
  const passes: Pass[] = [];
  const add = (category: IssueCategory, code: PassCode) => passes.push({ category, code });

  const { https, securityHeaders, metaTags, altImages, sitemapRobots, brokenLinks, pagespeed } = input;

  if (https?.passed && !https.noHttpRedirect) add("security", "https");
  if (https?.passed && securityHeaders?.hasHsts && securityHeaders.hasCsp && securityHeaders.hasClickjackingProtection) {
    add("security", "security-headers");
  }

  // Our own read of the page first; Lighthouse's audits when our fetch
  // didn't get the HTML, same fallback as deriveIssues.
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
