import { describe, expect, it } from "vitest";
import { parseSecurityHeaders } from "./securityHeaders";

describe("parseSecurityHeaders", () => {
  it("reports everything missing when no security headers are present", () => {
    const result = parseSecurityHeaders(new Headers());

    expect(result).toEqual({ hasHsts: false, hasCsp: false, hasClickjackingProtection: false });
  });

  it("detects HSTS", () => {
    const result = parseSecurityHeaders(new Headers({ "Strict-Transport-Security": "max-age=63072000" }));

    expect(result.hasHsts).toBe(true);
  });

  it("detects CSP", () => {
    const result = parseSecurityHeaders(new Headers({ "Content-Security-Policy": "default-src 'self'" }));

    expect(result.hasCsp).toBe(true);
  });

  it("detects clickjacking protection via X-Frame-Options", () => {
    const result = parseSecurityHeaders(new Headers({ "X-Frame-Options": "DENY" }));

    expect(result.hasClickjackingProtection).toBe(true);
  });

  it("detects clickjacking protection via CSP frame-ancestors, without a separate X-Frame-Options header", () => {
    const result = parseSecurityHeaders(new Headers({ "Content-Security-Policy": "frame-ancestors 'none'" }));

    expect(result.hasClickjackingProtection).toBe(true);
  });

  it("is case-insensitive, same as real HTTP headers", () => {
    // Headers is spec'd to be case-insensitive, but worth locking in
    // explicitly since the checks here read specific lowercase names.
    const result = parseSecurityHeaders(new Headers({ "STRICT-TRANSPORT-SECURITY": "max-age=1" }));

    expect(result.hasHsts).toBe(true);
  });
});
