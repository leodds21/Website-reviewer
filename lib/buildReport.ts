import type { CheckResults } from "./checkResults";
import type { CheckFailures, CheckKey } from "./checkFailure";
import type { TechPlatform } from "./checks/techDetect";
import type { AnalyzeReport } from "./report";
import { aggregateScore } from "./score";
import { deriveIssues } from "./issues";
import { derivePasses } from "./passes";

export type ReportInput = {
  domain: string;
  results: Partial<CheckResults>;
  failures: CheckFailures;
  platform: TechPlatform | null;
  checkedAt: string;
  // Checks still running; empty for the final report.
  pending?: readonly CheckKey[];
};

// One builder for the partial and the final report, so both score the same way.
export function buildReport({ domain, results, failures, platform, checkedAt, pending = [] }: ReportInput): AnalyzeReport {
  return {
    domain,
    score: aggregateScore(results, failures, pending),
    issues: deriveIssues(results),
    passed: derivePasses(results),
    loadSeconds: results.pagespeed?.lcpSeconds,
    platform,
    blocked: Object.values(failures).includes("blocked"),
    checkedAt,
    ...(pending.length > 0 && { inProgress: true as const }),
  };
}
