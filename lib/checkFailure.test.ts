import { describe, expect, it } from "vitest";
import { classifyCheckFailure, primaryReason } from "./checkFailure";
import { HttpStatusError, UnreachableError } from "./httpStatus";
import { PageSpeedError } from "./pagespeed";
import { BlockedHostError } from "./safeFetch";

describe("classifyCheckFailure", () => {
  it.each([401, 403, 429, 503])("calls a %i from the site a refusal", (status) => {
    expect(classifyCheckFailure(new HttpStatusError(status, "x"))).toBe("blocked");
  });

  it("calls a 404/500 page a site error, not a refusal", () => {
    expect(classifyCheckFailure(new HttpStatusError(404, "x"))).toBe("site-error");
    expect(classifyCheckFailure(new HttpStatusError(500, "x"))).toBe("site-error");
  });

  it("reads PageSpeed's 429 as our daily quota running out", () => {
    expect(classifyCheckFailure(new PageSpeedError("PageSpeed API returned 429: quota", 429))).toBe("quota");
  });

  it("reads the page status Lighthouse reports inside its error body", () => {
    const refused = new PageSpeedError(
      'PageSpeed API returned 500: {"error":{"message":"Lighthouse returned error: ERRORED_DOCUMENT_REQUEST. Lighthouse was unable to reliably load the page you requested. (Status code: 403)"}}',
      500,
    );
    const notFound = new PageSpeedError("Lighthouse returned error: ERRORED_DOCUMENT_REQUEST. (Status code: 404)", 500);

    expect(classifyCheckFailure(refused)).toBe("blocked");
    expect(classifyCheckFailure(notFound)).toBe("site-error");
  });

  it("calls a Lighthouse page-load failure with no status unreachable", () => {
    const error = new PageSpeedError("Lighthouse returned error: FAILED_DOCUMENT_REQUEST. (Details: net::ERR_CONNECTION_FAILED)", 400);
    expect(classifyCheckFailure(error)).toBe("unreachable");
  });

  it("calls any other PageSpeed error a failed measurement", () => {
    expect(classifyCheckFailure(new PageSpeedError("Lighthouse returned error: NO_FCP", 500))).toBe("measurement-failed");
  });

  it("recognizes our own timeouts", () => {
    expect(classifyCheckFailure(new DOMException("timed out", "TimeoutError"))).toBe("timeout");
  });

  it("calls network-level failures unreachable", () => {
    expect(classifyCheckFailure(new TypeError("fetch failed"))).toBe("unreachable");
    expect(classifyCheckFailure(new UnreachableError("Origin unreachable: https://x.com"))).toBe("unreachable");
    // By type, not by wording: an unrelated message mentioning it stays unknown.
    expect(classifyCheckFailure(new Error("cache unreachable"))).toBe("unknown");
    expect(classifyCheckFailure(new BlockedHostError("10.0.0.1"))).toBe("unreachable");
  });

  it("falls back to unknown", () => {
    expect(classifyCheckFailure(new Error("PAGESPEED_API_KEY is not set"))).toBe("unknown");
    expect(classifyCheckFailure("not even an error")).toBe("unknown");
  });
});

describe("primaryReason", () => {
  it("prefers a refusal over a transient failure, and ignores missing entries", () => {
    expect(primaryReason([undefined, "timeout", "blocked"])).toBe("blocked");
    expect(primaryReason([undefined])).toBeUndefined();
  });
});
