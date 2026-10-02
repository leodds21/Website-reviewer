import type { Browser } from "playwright-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureViewport } from "./captureScreenshot";
import { captureWebsiteScreenshots } from "./captureWebsiteScreenshots";
import { launchBrowser } from "./launchBrowser";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) }));
vi.mock("./launchBrowser", () => ({ launchBrowser: vi.fn() }));
// VIEWPORTS stays real; only the browser-driving capture is replaced.
vi.mock("./captureScreenshot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./captureScreenshot")>()),
  captureViewport: vi.fn(),
}));

// Behaves like a real browser where it matters: closing it makes any
// capture still in flight reject, as Playwright does.
function fakeBrowser() {
  let onClose: () => void = () => {};
  const closed = new Promise<never>((_resolve, reject) => {
    onClose = () => reject(new Error("Target page, context or browser has been closed"));
  });
  closed.catch(() => {});
  const close = vi.fn(async () => onClose());
  return { browser: { close, version: () => "141.0.0.0" } as unknown as Browser, close, closed };
}

beforeEach(() => {
  vi.mocked(launchBrowser).mockReset();
  vi.mocked(captureViewport).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("captureWebsiteScreenshots", () => {
  it("returns a desktop and a mobile WebP, at their own viewport sizes, and closes the browser", async () => {
    const { browser, close } = fakeBrowser();
    vi.mocked(launchBrowser).mockResolvedValue(browser);
    vi.mocked(captureViewport).mockImplementation(async (_browser, _url, viewport) => (viewport === "desktop" ? "REVTSw==" : "TU9C"));

    const shots = await captureWebsiteScreenshots("https://example.com/");

    expect(shots.desktop).toEqual({ status: "success", width: 1440, height: 900, src: "data:image/webp;base64,REVTSw==" });
    expect(shots.mobile).toEqual({ status: "success", width: 390, height: 844, src: "data:image/webp;base64,TU9C" });
    // One browser for both viewports, closed afterwards.
    expect(launchBrowser).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalled();
  });

  it("forces the browser through the egress proxy", async () => {
    const { browser } = fakeBrowser();
    vi.mocked(launchBrowser).mockResolvedValue(browser);
    vi.mocked(captureViewport).mockResolvedValue("AA==");

    await captureWebsiteScreenshots("https://example.com/");

    const args = vi.mocked(launchBrowser).mock.calls[0][0] ?? [];
    expect(args.some((arg) => /^--proxy-server=http:\/\/127\.0\.0\.1:\d+$/.test(arg))).toBe(true);
    expect(args).toContain("--proxy-bypass-list=<-loopback>");
  });

  it("keeps the viewport that worked when only the other one fails", async () => {
    const { browser } = fakeBrowser();
    vi.mocked(launchBrowser).mockResolvedValue(browser);
    vi.mocked(captureViewport).mockImplementation(async (_browser, _url, viewport) => {
      if (viewport === "mobile") throw Object.assign(new Error("page.goto: Timeout 15000ms exceeded."), { name: "TimeoutError" });
      return "AA==";
    });

    const shots = await captureWebsiteScreenshots("https://example.com/");

    expect(shots.desktop.status).toBe("success");
    expect(shots.mobile).toEqual({ status: "failed", width: 390, height: 844, reason: "timeout" });
  });

  it.each([
    ["localhost", "http://localhost/"],
    ["a private IP", "http://10.0.0.1/"],
    ["the cloud metadata endpoint", "http://169.254.169.254/latest/meta-data/"],
    ["a non-http protocol", "ftp://example.com/file"],
    ["a file URL", "file:///etc/passwd"],
    ["a malformed URL", "not a url"],
  ])("refuses %s without ever launching a browser", async (_label, url) => {
    const shots = await captureWebsiteScreenshots(url);

    expect(shots.desktop.status).toBe("failed");
    expect(shots.mobile.status).toBe("failed");
    expect(launchBrowser).not.toHaveBeenCalled();
  });

  it("reports a site the browser couldn't reach as unreachable", async () => {
    const { browser } = fakeBrowser();
    vi.mocked(launchBrowser).mockResolvedValue(browser);
    vi.mocked(captureViewport).mockRejectedValue(new Error("page.goto: net::ERR_NAME_NOT_RESOLVED at https://example.com/"));

    const shots = await captureWebsiteScreenshots("https://example.com/");

    expect(shots.desktop).toMatchObject({ status: "failed", reason: "unreachable" });
  });

  it("reports a bot wall (403 on the page) as blocked", async () => {
    const { HttpStatusError } = await import("../httpStatus");
    const { browser } = fakeBrowser();
    vi.mocked(launchBrowser).mockResolvedValue(browser);
    vi.mocked(captureViewport).mockRejectedValue(new HttpStatusError(403, "A página respondeu 403."));

    const shots = await captureWebsiteScreenshots("https://example.com/");

    expect(shots.mobile).toMatchObject({ status: "failed", reason: "blocked" });
  });

  it("gives up at the time budget, closing the browser so nothing hangs, and calls it a timeout", async () => {
    const { browser, close, closed } = fakeBrowser();
    vi.mocked(launchBrowser).mockResolvedValue(browser);
    // A page that never finishes loading: only the browser closing ends it.
    vi.mocked(captureViewport).mockReturnValue(closed);
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("budget", "TimeoutError")), 20);

    const shots = await captureWebsiteScreenshots("https://example.com/", controller.signal);

    expect(shots.desktop).toMatchObject({ status: "failed", reason: "timeout" });
    expect(shots.mobile).toMatchObject({ status: "failed", reason: "timeout" });
    expect(close).toHaveBeenCalled();
  });

  it("never throws when the browser itself fails to start", async () => {
    vi.mocked(launchBrowser).mockRejectedValue(new Error("Failed to launch the browser process"));

    const shots = await captureWebsiteScreenshots("https://example.com/");

    expect(shots).toEqual({
      desktop: { status: "failed", width: 1440, height: 900, reason: "unknown" },
      mobile: { status: "failed", width: 390, height: 844, reason: "unknown" },
    });
  });
});
