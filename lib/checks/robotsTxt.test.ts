import { describe, expect, it } from "vitest";
import { blocksGooglebot } from "./robotsTxt";

describe("blocksGooglebot", () => {
  it("blocks every path under Disallow: /", () => {
    expect(blocksGooglebot("User-agent: *\nDisallow: /", "/")).toBe(true);
    expect(blocksGooglebot("User-agent: *\nDisallow: /", "/servicos")).toBe(true);
  });

  it("only blocks the paths a rule covers", () => {
    const text = "User-agent: *\nDisallow: /admin";
    expect(blocksGooglebot(text, "/")).toBe(false);
    expect(blocksGooglebot(text, "/admin/login")).toBe(true);
  });

  it("allows everything with an empty Disallow or no rules", () => {
    expect(blocksGooglebot("User-agent: *\nDisallow:", "/")).toBe(false);
    expect(blocksGooglebot("", "/")).toBe(false);
    expect(blocksGooglebot("Sitemap: https://x.com/sitemap.xml", "/")).toBe(false);
  });

  it("follows the Googlebot group over the * group", () => {
    const text = "User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /";
    expect(blocksGooglebot(text, "/")).toBe(false);
    expect(blocksGooglebot("User-agent: *\nAllow: /\n\nUser-agent: googlebot\nDisallow: /", "/")).toBe(true);
  });

  it("ignores groups for other crawlers", () => {
    expect(blocksGooglebot("User-agent: Bingbot\nDisallow: /", "/")).toBe(false);
    expect(blocksGooglebot("User-agent: Googlebot-Image\nDisallow: /", "/")).toBe(false);
  });

  it("shares one group across consecutive user-agent lines", () => {
    expect(blocksGooglebot("User-agent: Bingbot\nUser-agent: Googlebot\nDisallow: /", "/")).toBe(true);
  });

  it("lets the longest rule win, and Allow win a tie", () => {
    expect(blocksGooglebot("User-agent: *\nDisallow: /\nAllow: /blog", "/blog/post")).toBe(false);
    expect(blocksGooglebot("User-agent: *\nAllow: /blog\nDisallow: /blog/rascunhos", "/blog/rascunhos/1")).toBe(true);
    expect(blocksGooglebot("User-agent: *\nDisallow: /page\nAllow: /page", "/page")).toBe(false);
  });

  it("understands * and $", () => {
    expect(blocksGooglebot("User-agent: *\nDisallow: /$", "/")).toBe(true);
    expect(blocksGooglebot("User-agent: *\nDisallow: /$", "/contato")).toBe(false);
    expect(blocksGooglebot("User-agent: *\nDisallow: /*.pdf$", "/docs/a.pdf")).toBe(true);
    expect(blocksGooglebot("User-agent: *\nDisallow: /*?", "/busca?q=1")).toBe(true);
  });

  it("ignores comments, case in field names, and Windows line endings", () => {
    expect(blocksGooglebot("# all bots\r\nUSER-AGENT: * # everyone\r\nDISALLOW: / # nothing\r\n", "/")).toBe(true);
  });

  it("ignores rules that come before any user-agent", () => {
    expect(blocksGooglebot("Disallow: /\nUser-agent: *\nAllow: /", "/")).toBe(false);
  });
});
