import type { AggregatedScore } from "./score";
import type { Issue } from "./issues";

export type AnalyzeReport = {
  domain: string;
  score: AggregatedScore;
  issues: Issue[];
  checkedAt: string;
};
