import { describe, expect, it } from "vitest";
import { parseMixedContent } from "./mixedContent";

describe("parseMixedContent", () => {
  it("counts resources loaded over http://", () => {
    const html = `
      <img src="http://cdn.example/a.png">
      <script src="HTTP://cdn.example/a.js"></script>
      <link rel="stylesheet" href="http://cdn.example/a.css">
      <iframe src="https://video.example/embed"></iframe>
      <form action="http://example.com/contato"></form>`;
    const result = parseMixedContent(html, null);
    expect(result.resourceCount).toBe(5);
    expect(result.insecureCount).toBe(4);
    expect(result.insecureUrls).toContain("http://cdn.example/a.css");
  });

  it("ignores plain links, other link types, protocol-relative URLs and script bodies", () => {
    const html = `
      <a href="http://old.example/">old site</a>
      <link rel="canonical" href="http://example.com/">
      <img src="//cdn.example/a.png">
      <script>const legacy = "<img src='http://x.example/a.png'>";</script>
      <!-- <img src="http://x.example/b.png"> -->`;
    expect(parseMixedContent(html, null).insecureCount).toBe(0);
  });

  it("counts nothing when the page upgrades insecure requests", () => {
    const html = '<img src="http://cdn.example/a.png">';
    expect(parseMixedContent(html, "default-src 'self'; upgrade-insecure-requests").insecureCount).toBe(0);
    const meta = `<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">${html}`;
    expect(parseMixedContent(meta, null).insecureCount).toBe(0);
  });

  it("keeps a short, de-duplicated sample", () => {
    const html = Array.from({ length: 30 }, (_, i) => `<img src="http://cdn.example/${i}.png"><img src="http://cdn.example/${i}.png">`).join("");
    const result = parseMixedContent(html, null);
    expect(result.insecureCount).toBe(60);
    expect(result.insecureUrls).toHaveLength(20);
    expect(parseMixedContent(`<img src="http://x.example/${"a".repeat(300)}">`, null).insecureUrls[0]).toHaveLength(201);
  });
});
