import { describe, expect, it } from "vitest";
import { parseFavicon } from "./favicon";

describe("parseFavicon", () => {
  it("finds icon links in any of their forms", () => {
    expect(parseFavicon('<link rel="icon" href="/i.png">').hasIconLink).toBe(true);
    expect(parseFavicon('<link rel="shortcut icon" href="/f.ico">').hasIconLink).toBe(true);
    expect(parseFavicon('<link href="/a.png" rel="apple-touch-icon">').hasIconLink).toBe(true);
  });

  it("doesn't count other links", () => {
    expect(parseFavicon('<link rel="stylesheet" href="/icon.css">').hasIconLink).toBe(false);
  });
});
