import { HttpStatusError, isBotBlockStatus } from "./httpStatus";
import { PageSpeedError } from "./pagespeed";

/**
 * Why a check couldn't produce a result, in terms the report can turn
 * into a plain-language explanation. Never the raw error: that can
 * carry internal detail (API keys in a URL, resolved internal
 * hostnames) that stays in the server log.
 */
export type FailureReason =
  // The site refused an automated client (WAF, bot wall, rate limit),
  // either to us or to Google's Lighthouse run.
  | "blocked"
  // Our own per-check time limit ran out.
  | "timeout"
  // DNS, refused connection, broken TLS: the site couldn't be reached.
  | "unreachable"
  // The site answered, but with an error page (404, 500) instead of content.
  | "site-error"
  // Google's daily PageSpeed quota for our key ran out.
  | "quota"
  // PageSpeed ran but couldn't produce a measurement (e.g. no content painted).
  | "measurement-failed"
  | "unknown";

/** The independent tasks the route runs; the keys failures are recorded under. */
export type CheckKey = "https" | "page" | "sitemapRobots" | "pagespeed" | "brokenLinks";

export type CheckFailures = Partial<Record<CheckKey, FailureReason>>;

// Lighthouse reports the status the page itself returned inside its
// error message, e.g. "ERRORED_DOCUMENT_REQUEST ... (Status code: 403)".
const LIGHTHOUSE_STATUS = /Status code:\s*(\d{3})/i;
const LIGHTHOUSE_LOAD_FAILURE = /FAILED_DOCUMENT_REQUEST|DNS_FAILURE|ERRORED_DOCUMENT_REQUEST/;

function classifyPageSpeed(error: PageSpeedError): FailureReason {
  if (error.status === 429) return "quota";

  const pageStatus = error.message.match(LIGHTHOUSE_STATUS);
  if (pageStatus) return isBotBlockStatus(Number(pageStatus[1])) ? "blocked" : "site-error";

  if (LIGHTHOUSE_LOAD_FAILURE.test(error.message)) return "unreachable";
  return "measurement-failed";
}

export function classifyCheckFailure(error: unknown): FailureReason {
  if (error instanceof HttpStatusError) return isBotBlockStatus(error.status) ? "blocked" : "site-error";
  if (error instanceof PageSpeedError) return classifyPageSpeed(error);

  const name = (error as { name?: unknown } | null)?.name;
  if (name === "TimeoutError" || name === "AbortError") return "timeout";

  // fetch() rejects with a TypeError for anything network-level (DNS,
  // refused connection, TLS); BlockedHostError is our SSRF guard
  // refusing where the site pointed us. Either way, nothing to analyze.
  if (error instanceof TypeError || name === "BlockedHostError") return "unreachable";
  if (error instanceof Error && /inacess/i.test(error.message)) return "unreachable";

  return "unknown";
}

// When a category draws on several failed checks, the reason shown is
// the one most useful to the visitor: a refusal explains the most (and
// leads to the manual-analysis offer), a transient one ("try again")
// beats a vague one.
const REASON_PRIORITY: FailureReason[] = [
  "blocked",
  "quota",
  "timeout",
  "unreachable",
  "site-error",
  "measurement-failed",
  "unknown",
];

export function primaryReason(reasons: (FailureReason | undefined)[]): FailureReason | undefined {
  return REASON_PRIORITY.find((reason) => reasons.includes(reason));
}
