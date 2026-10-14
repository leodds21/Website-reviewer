import type { PageSpeedResult } from "./pagespeed";
import type { HttpsCheckResult } from "./checks/https";
import type { MetaTagsCheckResult } from "./checks/metaTags";
import type { AltImagesCheckResult } from "./checks/altImages";
import type { SitemapRobotsCheckResult } from "./checks/sitemapRobots";
import type { SecurityHeadersCheckResult } from "./checks/securityHeaders";
import type { BrokenLinksCheckResult } from "./checks/brokenLinks";
import type { IndexingCheckResult } from "./checks/indexing";
import type { SocialPreviewCheckResult } from "./checks/socialPreview";
import type { StructuredDataCheckResult } from "./checks/structuredData";
import type { HtmlLangCheckResult } from "./checks/htmlLang";
import type { MixedContentCheckResult } from "./checks/mixedContent";
import type { FaviconCheckResult } from "./checks/favicon";

export type CheckResults = {
  https: HttpsCheckResult;
  securityHeaders: SecurityHeadersCheckResult;
  metaTags: MetaTagsCheckResult;
  altImages: AltImagesCheckResult;
  sitemapRobots: SitemapRobotsCheckResult;
  pagespeed: PageSpeedResult;
  brokenLinks: BrokenLinksCheckResult;
  indexing: IndexingCheckResult;
  socialPreview: SocialPreviewCheckResult;
  structuredData: StructuredDataCheckResult;
  htmlLang: HtmlLangCheckResult;
  // Only for pages fetched over https.
  mixedContent: MixedContentCheckResult;
  favicon: FaviconCheckResult;
};
