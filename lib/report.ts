import type { AggregatedScore } from "./score";
import type { Issue } from "./issues";
import type { Pass } from "./passes";
import type { TechPlatform } from "./checks/techDetect";

export type AnalyzeReport = {
  domain: string;
  score: AggregatedScore;
  issues: Issue[];
  // Optional fields may be missing from reports cached by older versions.
  passed?: Pass[];
  // LCP from Lighthouse's mobile run, in seconds.
  loadSeconds?: number;
  platform: TechPlatform | null;
  // The site or Lighthouse refused automated access.
  blocked?: boolean;
  checkedAt: string;
};
