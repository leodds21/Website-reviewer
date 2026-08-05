import { describe, expect, it } from "vitest";
import { synthesizeCriticalImpact } from "./translations";
import type { Issue } from "@/lib/issues";

function issue(code: Issue["code"]): Issue {
  return { category: "security", severity: "critico", code };
}

describe("synthesizeCriticalImpact", () => {
  it("returns null when there are no critical issues", () => {
    expect(synthesizeCriticalImpact("pt", [])).toBeNull();
  });

  it("builds a single-clause sentence for one critical issue", () => {
    const result = synthesizeCriticalImpact("pt", [issue("no-https")]);

    expect(result).toContain("insegurança da conexão");
    expect(result).toMatch(/^A /); // capitalized, not "a insegurança..."
  });

  it("joins two clauses and caps at two even with more critical issues", () => {
    const result = synthesizeCriticalImpact("pt", [issue("no-https"), issue("invalid-certificate"), issue("no-title")]);

    expect(result).toContain("insegurança da conexão");
    expect(result).toContain("certificado de segurança");
    expect(result).not.toContain("título"); // third issue's clause excluded
  });

  it("skips issues whose code has no clause defined yet", () => {
    // no-sitemap has no impactClause entry (yet) — shouldn't crash, and
    // shouldn't produce an empty/broken sentence around a missing piece.
    const result = synthesizeCriticalImpact("pt", [issue("no-sitemap"), issue("no-https")]);

    expect(result).toContain("insegurança da conexão");
    expect(result).not.toContain("undefined");
  });

  it("produces English output in en locale", () => {
    const result = synthesizeCriticalImpact("en", [issue("no-https")]);

    expect(result).toContain("insecure connection");
    expect(result).toMatch(/^The /);
  });
});
