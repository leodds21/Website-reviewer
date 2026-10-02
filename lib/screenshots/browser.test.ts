import type { Browser } from "playwright-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withBrowser } from "./browser";
import { launchBrowser } from "./launchBrowser";

vi.mock("./launchBrowser", () => ({ launchBrowser: vi.fn() }));

function fakeBrowser() {
  const close = vi.fn(async () => {});
  return { browser: { close } as unknown as Browser, close };
}

beforeEach(() => {
  vi.mocked(launchBrowser).mockReset();
});

describe("withBrowser", () => {
  it("closes the browser after a successful run", async () => {
    const { browser, close } = fakeBrowser();
    vi.mocked(launchBrowser).mockResolvedValue(browser);

    await expect(withBrowser(new AbortController().signal, [], async () => "ok")).resolves.toBe("ok");
    expect(close).toHaveBeenCalled();
  });

  it("closes the browser when the run throws", async () => {
    const { browser, close } = fakeBrowser();
    vi.mocked(launchBrowser).mockResolvedValue(browser);

    await expect(
      withBrowser(new AbortController().signal, [], async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(close).toHaveBeenCalled();
  });

  it("closes a browser that finished launching after the caller already gave up", async () => {
    const { browser, close } = fakeBrowser();
    const controller = new AbortController();
    vi.mocked(launchBrowser).mockImplementation(async () => {
      controller.abort(new DOMException("budget", "TimeoutError"));
      return browser;
    });
    const run = vi.fn(async () => "never");

    await expect(withBrowser(controller.signal, [], run)).rejects.toMatchObject({ name: "TimeoutError" });
    expect(run).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it("runs one browser at a time per instance; the next waits for the slot", async () => {
    let releaseFirst: () => void = () => {};
    vi.mocked(launchBrowser).mockImplementation(async () => fakeBrowser().browser);

    const first = withBrowser(new AbortController().signal, [], () => new Promise<void>((resolve) => (releaseFirst = resolve)));
    const second = withBrowser(new AbortController().signal, [], async () => "second");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(launchBrowser).toHaveBeenCalledTimes(1);
    releaseFirst();
    await first;
    await expect(second).resolves.toBe("second");
    expect(launchBrowser).toHaveBeenCalledTimes(2);
  });

  it("gives up waiting for a slot when the caller's budget runs out, without launching", async () => {
    let releaseFirst: () => void = () => {};
    vi.mocked(launchBrowser).mockImplementation(async () => fakeBrowser().browser);
    const first = withBrowser(new AbortController().signal, [], () => new Promise<void>((resolve) => (releaseFirst = resolve)));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const waiting = withBrowser(AbortSignal.timeout(20), [], async () => "late");

    await expect(waiting).rejects.toMatchObject({ name: "TimeoutError" });
    expect(launchBrowser).toHaveBeenCalledTimes(1);
    releaseFirst();
    await first;
  });
});
