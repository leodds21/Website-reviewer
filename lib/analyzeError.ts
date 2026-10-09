// Codes, not messages: the client translates them.
export type AnalyzeErrorCode =
  | "missing-url"
  | "invalid-url"
  | "blocked-url"
  | "rate-limited"
  // Google's PageSpeed quota, not our per-IP limit.
  | "quota-exceeded"
  | "analysis-failed"
  | "site-blocked"
  | "site-unreachable"
  | "timeout"
  | "offline"
  | "unknown"
  // A report link whose report expired from the cache.
  | "not-cached";

export type AnalyzeError = { code: AnalyzeErrorCode; retryAfterSeconds?: number };
