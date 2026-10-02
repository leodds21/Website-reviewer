import type { AggregatedScore } from "./score";
import type { Issue } from "./issues";
import type { TechPlatform } from "./checks/techDetect";

export type AnalyzeReport = {
  domain: string;
  score: AggregatedScore;
  issues: Issue[];
  // Which site-builder platform (if any) the page's own markup gave
  // away. Deliberately not an Issue: which platform a site runs on
  // isn't a problem to fix, just a neutral fact about it.
  platform: TechPlatform | null;
  // True when the site (or Google's Lighthouse run against it) refused
  // automated access. Optional: reports cached before this field existed
  // simply don't have it, and read as not blocked.
  blocked?: boolean;
  checkedAt: string;
};
