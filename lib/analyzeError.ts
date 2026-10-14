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
  // Client-only: an older ?url= link filled the field (shown as a note, not an error).
  | "not-cached";

export type AnalyzeError = { code: AnalyzeErrorCode; retryAfterSeconds?: number };
