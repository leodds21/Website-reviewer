import type { PageSpeedResult } from "./pagespeed";
import type { HttpsCheckResult } from "./checks/https";
import type { MetaTagsCheckResult } from "./checks/metaTags";
import type { AltImagesCheckResult } from "./checks/altImages";
import type { SitemapRobotsCheckResult } from "./checks/sitemapRobots";
import type { SecurityHeadersCheckResult } from "./checks/securityHeaders";
import type { BrokenLinksCheckResult } from "./checks/brokenLinks";

export type CheckResults = {
  https: HttpsCheckResult;
  securityHeaders: SecurityHeadersCheckResult;
  metaTags: MetaTagsCheckResult;
  altImages: AltImagesCheckResult;
  sitemapRobots: SitemapRobotsCheckResult;
  pagespeed: PageSpeedResult;
  brokenLinks: BrokenLinksCheckResult;
};
