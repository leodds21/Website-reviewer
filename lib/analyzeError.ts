/**
 * Machine-readable reasons an analysis can fail, shared by the API
 * route and the UI.
 *
 * A code, never a prose message: the route runs server-side with no
 * idea which language the visitor picked, so anything it phrases
 * itself would be stuck in one language (the previous version really
 * did send Portuguese to English visitors). The client owns the
 * wording, which also means one place to translate and no user-facing
 * copy living in the backend.
 */
export type AnalyzeErrorCode =
  | "missing-url"
  | "invalid-url"
  | "blocked-url"
  | "rate-limited"
  // Distinct from "rate-limited": that's our own per-IP limit, this is
  // Google's PageSpeed quota for our API key running out — a different
  // problem the visitor can't do anything about by waiting an hour.
  | "quota-exceeded"
  | "analysis-failed"
  // Every check failed because the site refused automated access, or
  // couldn't be reached at all. Separate from "analysis-failed" so the
  // message can say which, instead of listing every possibility.
  | "site-blocked"
  | "site-unreachable"
  | "timeout"
  | "offline"
  | "unknown"
  // A report link was opened, but its report is no longer cached (6h).
  // Not a failure: the page offers to run the analysis instead of
  // spending quota on a link nobody chose to run.
  | "not-cached";

export type AnalyzeError = { code: AnalyzeErrorCode; retryAfterSeconds?: number };
