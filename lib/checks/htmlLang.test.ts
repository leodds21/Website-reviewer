import { describe, expect, it } from "vitest";
import { parseHtmlLang } from "./htmlLang";

describe("parseHtmlLang", () => {
  it("reads the lang of the <html> tag", () => {
    expect(parseHtmlLang('<!doctype html><html lang="pt-BR"><head>').lang).toBe("pt-BR");
  });

  it("treats a missing, empty or xml:lang-only attribute as no language", () => {
    expect(parseHtmlLang("<html><head>").lang).toBeNull();
    expect(parseHtmlLang('<html lang=""><head>').lang).toBeNull();
    expect(parseHtmlLang('<html xml:lang="en"><head>').lang).toBeNull();
  });
});
