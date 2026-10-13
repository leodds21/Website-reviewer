import { describe, expect, it } from "vitest";
import { localeInPath, resolveLocale } from "./resolveLocale";

describe("resolveLocale", () => {
  it("prefers an explicit ?lang= param over everything else", () => {
    expect(resolveLocale("en", "pt", "pt-BR")).toBe("en");
    expect(resolveLocale("pt", "en", "en-US")).toBe("pt-BR");
  });

  it("falls back to the cookie when there is no query param", () => {
    expect(resolveLocale(null, "en", "pt-BR")).toBe("en");
    expect(resolveLocale(null, "pt", "en-US")).toBe("pt-BR");
  });

  it("ignores an invalid query param or cookie value", () => {
    expect(resolveLocale("fr", "en", "en-US")).toBe("en");
    expect(resolveLocale(null, "fr", "en-US")).toBe("en");
  });

  it("falls back to Accept-Language when there is no param or cookie", () => {
    expect(resolveLocale(null, null, "en-US,en;q=0.9,pt;q=0.8")).toBe("en");
    expect(resolveLocale(null, null, "pt-BR,pt;q=0.9")).toBe("pt-BR");
  });

  it("defaults to pt-BR when Accept-Language is missing or unrecognized", () => {
    expect(resolveLocale(null, null, null)).toBe("pt-BR");
    expect(resolveLocale(null, null, "fr-FR,fr;q=0.9")).toBe("pt-BR");
  });
});

describe("resolveLocale with the current locale codes", () => {
  it("accepts pt-BR and the older pt from links and cookies", () => {
    expect(resolveLocale("pt-BR", null, "en-US")).toBe("pt-BR");
    expect(resolveLocale(null, "pt", "en-US")).toBe("pt-BR");
  });
});

describe("localeInPath", () => {
  it("reads the locale a path starts with", () => {
    expect(localeInPath("/pt-BR")).toBe("pt-BR");
    expect(localeInPath("/en/report/abc")).toBe("en");
  });

  it("returns null for paths outside a locale, including look-alikes", () => {
    expect(localeInPath("/")).toBeNull();
    expect(localeInPath("/pt")).toBeNull();
    expect(localeInPath("/english")).toBeNull();
    expect(localeInPath("/pt-BRx")).toBeNull();
  });
});
