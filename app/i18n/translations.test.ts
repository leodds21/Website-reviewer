import { describe, expect, it } from "vitest";
import { synthesizeCriticalImpact } from "./translations";
import type { Issue } from "@/lib/issues";

const CATEGORY_BY_CODE: Record<Issue["code"], Issue["category"]> = {
  "no-https": "security",
  "invalid-certificate": "security",
  "no-hsts": "security",
  "no-csp": "security",
  "no-clickjacking-protection": "security",
  "no-title": "seo",
  "generic-title": "seo",
  "no-description": "seo",
  "no-viewport": "accessibility",
  "missing-alt": "accessibility",
  "no-sitemap": "seo",
  "low-performance": "performance",
  "slow-load-impact": "performance",
  "layout-shift": "performance",
  "color-contrast": "accessibility",
};

function issue(code: Issue["code"]): Issue {
  return { category: CATEGORY_BY_CODE[code], severity: "critico", code };
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
    const result = synthesizeCriticalImpact("pt", [issue("no-https"), issue("no-title"), issue("missing-alt")]);

    expect(result).toContain("insegurança da conexão");
    expect(result).toContain("título");
    expect(result).not.toContain("imagens sem descrição"); // third issue's clause excluded
  });

  it("skips issues whose code has no clause defined yet", () => {
    // no-sitemap has no impactClause entry (yet) — shouldn't crash, and
    // shouldn't produce an empty/broken sentence around a missing piece.
    const result = synthesizeCriticalImpact("pt", [issue("no-sitemap"), issue("no-https")]);

    expect(result).toContain("insegurança da conexão");
    expect(result).not.toContain("undefined");
  });

  it("caps at one clause per category, so co-occurring performance findings don't duplicate each other", () => {
    // low-performance and slow-load-impact are both "performance" and
    // can both be critical from the same pagespeed run — pairing their
    // clauses would read as the same problem said twice.
    const result = synthesizeCriticalImpact("pt", [issue("low-performance"), issue("slow-load-impact"), issue("no-https")]);

    expect(result).toContain("lentidão geral do carregamento");
    expect(result).not.toContain("tempo de carregamento alto");
    expect(result).toContain("insegurança da conexão");
  });

  it("produces English output in en locale", () => {
    const result = synthesizeCriticalImpact("en", [issue("no-https")]);

    expect(result).toContain("insecure connection");
    expect(result).toMatch(/^The /);
  });
});
