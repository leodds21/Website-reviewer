import type { AggregatedScore } from "./score";
import type { Issue } from "./issues";
import type { Pass } from "./passes";
import type { TechPlatform } from "./checks/techDetect";

export type AnalyzeReport = {
  domain: string;
  score: AggregatedScore;
  issues: Issue[];
  // What was measured and came out right ("o que está certo").
  // Optional: reports cached before this field existed don't have it,
  // and show no such list.
  passed?: Pass[];
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
