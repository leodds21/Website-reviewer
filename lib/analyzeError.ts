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
  | "analysis-failed"
  | "timeout"
  | "offline"
  | "unknown";

export type AnalyzeError = { code: AnalyzeErrorCode; retryAfterSeconds?: number };
