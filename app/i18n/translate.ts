import type { Issue, IssueCode } from "@/lib/issues";
import type { AnalyzeError } from "@/lib/analyzeError";
import type { ScoreComponent } from "@/lib/score";
import type { Dictionary, IssueParams } from "./types";

// Helpers take the dictionary, not the locale, so a page only ships its own language.
export function translateIssue(t: Dictionary, code: IssueCode, params: IssueParams): { title: string; description: string } {
  // A cached report or a newer server can send a code this bundle doesn't know.
  const entry = t.issue[code];
  if (!entry) return { title: code, description: "" };
  return entry(params);
}

export function translateRecommendation(t: Dictionary, code: IssueCode): string {
  return t.recommendation[code] ?? "";
}

export function translateScoreComponent(t: Dictionary, { key, value, count }: ScoreComponent): string {
  return t.scoreComponent[key]?.(value, count) ?? key;
}

export function translateAnalysisError(t: Dictionary, error: AnalyzeError): string {
  // Same for error codes from a newer server.
  const entry = t.analysisError[error.code] ?? t.analysisError.unknown;
  return entry(error.retryAfterSeconds);
}

// One sentence from the first 1-2 critical findings, at most one per
// category so two performance findings don't repeat each other.
export function synthesizeCriticalImpact(t: Dictionary, criticalIssues: Issue[]): string | null {
  const seenCategories = new Set<Issue["category"]>();

  const clauses = criticalIssues
    .filter((issue) => {
      if (seenCategories.has(issue.category)) return false;
      seenCategories.add(issue.category);
      return true;
    })
    .map((issue) => t.impactClause[issue.code])
    .filter((clause): clause is string => Boolean(clause))
    .slice(0, 2);

  return clauses.length > 0 ? t.synthesizeImpact(clauses) : null;
}
