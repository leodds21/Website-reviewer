import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch, unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "./next.config";
import { config, proxy } from "./proxy";

const BASE = "https://scan.lsdias.dev";

describe("CSP coverage", () => {
  const PATHS = [
    "/",
    "/pt-BR",
    "/en",
    "/en/report/abc",
    "/pt-BR/opengraph-image",
    "/api/analyze",
    "/_next/static/chunks/app.js",
    "/icon.svg",
    "/robots.txt",
    "/sitemap.xml",
  ];

  // Two CSP headers would both be enforced; none would leave a path unprotected.
  for (const path of PATHS) {
    it(`gives ${path} exactly one CSP`, async () => {
      const url = `${BASE}${path}`;
      const viaProxy = unstable_doesMiddlewareMatch({ config, url, nextConfig });
      const response = await unstable_getResponseFromNextConfig({ url, nextConfig });
      const viaConfig = Boolean(response.headers.get("content-security-policy"));

      expect(viaProxy !== viaConfig).toBe(true);
    });
  }
});

describe("proxy", () => {
  const request = (path: string, headers: Record<string, string> = {}) => new NextRequest(`${BASE}${path}`, { headers });

  it("sends the root to the visitor's language", () => {
    expect(proxy(request("/", { "accept-language": "pt-BR,pt;q=0.9" })).headers.get("location")).toBe(`${BASE}/pt-BR`);
    expect(proxy(request("/", { "accept-language": "en-US" })).headers.get("location")).toBe(`${BASE}/en`);
  });

  it("prefers the remembered language over the browser's", () => {
    const response = proxy(request("/", { "accept-language": "pt-BR", cookie: "isdias-lang=en" }));

    expect(response.headers.get("location")).toBe(`${BASE}/en`);
  });

  it("keeps older ?lang= links working, without the parameter", () => {
    const response = proxy(request("/?lang=pt&url=exemplo.com.br", { "accept-language": "en-US" }));

    expect(response.headers.get("location")).toBe(`${BASE}/pt-BR?url=exemplo.com.br`);
  });

  it("gives a page a fresh nonce CSP and remembers its language", () => {
    const first = proxy(request("/en"));
    const second = proxy(request("/en"));

    expect(first.headers.get("content-security-policy")).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
    expect(first.headers.get("content-security-policy")).not.toBe(second.headers.get("content-security-policy"));
    expect(first.cookies.get("isdias-lang")?.value).toBe("en");
  });
});
