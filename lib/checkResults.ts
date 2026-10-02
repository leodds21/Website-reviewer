import type { PageSpeedResult } from "./pagespeed";
import type { HttpsCheckResult } from "./checks/https";
import type { MetaTagsCheckResult } from "./checks/metaTags";
import type { AltImagesCheckResult } from "./checks/altImages";
import type { SitemapRobotsCheckResult } from "./checks/sitemapRobots";
import type { SecurityHeadersCheckResult } from "./checks/securityHeaders";
import type { BrokenLinksCheckResult } from "./checks/brokenLinks";

/**
 * Everything the checks can produce, one key per result. The single
 * place to touch when a new check is added: the route fills it in,
 * and aggregateScore/deriveIssues read it, each as Partial since any
 * one check may have failed to run.
 */
export type CheckResults = {
  https: HttpsCheckResult;
  securityHeaders: SecurityHeadersCheckResult;
  metaTags: MetaTagsCheckResult;
  altImages: AltImagesCheckResult;
  sitemapRobots: SitemapRobotsCheckResult;
  pagespeed: PageSpeedResult;
  brokenLinks: BrokenLinksCheckResult;
};
