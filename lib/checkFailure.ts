import { HttpStatusError, UnreachableError, isBotBlockStatus } from "./httpStatus";
import { PageSpeedError } from "./pageSpeedError";

// Never the raw error: it can carry internal detail (API keys, internal hosts).
export type FailureReason =
  // A WAF or bot wall refused us or Google's Lighthouse.
  | "blocked"
  | "timeout"
  // DNS, refused connection, broken TLS.
  | "unreachable"
  // The site answered with an error page (404, 500).
  | "site-error"
  // Our daily PageSpeed quota ran out.
  | "quota"
  // PageSpeed ran but got no measurement (e.g. nothing painted).
  | "measurement-failed"
  | "unknown";

export type CheckKey = "https" | "page" | "sitemapRobots" | "pagespeed" | "brokenLinks";

export type CheckFailures = Partial<Record<CheckKey, FailureReason>>;

// e.g. "ERRORED_DOCUMENT_REQUEST ... (Status code: 403)"
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

  // fetch() throws TypeError for network errors.
  if (error instanceof TypeError || error instanceof UnreachableError || name === "BlockedHostError") return "unreachable";

  return "unknown";
}

// Most useful to the visitor first: a refusal explains the most.
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
