import { describe, expect, it } from "vitest";
import { resolveLocale } from "./resolveLocale";

describe("resolveLocale", () => {
  it("prefers an explicit ?lang= param over everything else", () => {
    expect(resolveLocale("en", "pt", "pt-BR")).toBe("en");
    expect(resolveLocale("pt", "en", "en-US")).toBe("pt");
  });

  it("falls back to the cookie when there is no query param", () => {
    expect(resolveLocale(null, "en", "pt-BR")).toBe("en");
    expect(resolveLocale(null, "pt", "en-US")).toBe("pt");
  });

  it("ignores an invalid query param or cookie value", () => {
    expect(resolveLocale("fr", "en", "en-US")).toBe("en");
    expect(resolveLocale(null, "fr", "en-US")).toBe("en");
  });

  it("falls back to Accept-Language when there is no param or cookie", () => {
    expect(resolveLocale(null, null, "en-US,en;q=0.9,pt;q=0.8")).toBe("en");
    expect(resolveLocale(null, null, "pt-BR,pt;q=0.9")).toBe("pt");
  });

  it("defaults to pt when Accept-Language is missing or unrecognized", () => {
    expect(resolveLocale(null, null, null)).toBe("pt");
    expect(resolveLocale(null, null, "fr-FR,fr;q=0.9")).toBe("pt");
  });
});
