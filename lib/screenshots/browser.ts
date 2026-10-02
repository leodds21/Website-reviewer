import type { Browser } from "playwright-core";
import { launchBrowser } from "./launchBrowser";

// Browsers per server instance at once. A Chromium with two pages takes
// a few hundred MB, and on Vercel one instance can serve several
// requests concurrently, so captures beyond this wait their turn (still
// bounded by the caller's timeout) instead of each starting a browser.
// This is the single knob to turn, or to swap for a real queue later.
const MAX_CONCURRENT_BROWSERS = 1;

let active = 0;
const waiting: Array<() => void> = [];

function acquireSlot(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  if (active < MAX_CONCURRENT_BROWSERS) {
    active++;
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const grant = () => {
      signal.removeEventListener("abort", onAbort);
      active++;
      resolve();
    };
    const onAbort = () => {
      const index = waiting.indexOf(grant);
      if (index !== -1) waiting.splice(index, 1);
      reject(signal.reason);
    };
    waiting.push(grant);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function releaseSlot(): void {
  active--;
  waiting.shift()?.();
}

/**
 * Runs `run` with a freshly launched browser and always closes it
 * afterwards: on success, on error, and as soon as `signal` aborts
 * (timeout or the visitor leaving), which also makes any capture still
 * in flight reject instead of hanging. One browser per call, closed
 * every time, so nothing can outlive the request that started it.
 */
export async function withBrowser<T>(
  signal: AbortSignal,
  launchArgs: string[],
  run: (browser: Browser) => Promise<T>,
): Promise<T> {
  await acquireSlot(signal);

  let browser: Browser | undefined;
  const closeBrowser = () => browser?.close().catch(() => {});
  signal.addEventListener("abort", closeBrowser, { once: true });

  try {
    browser = await launchBrowser(launchArgs);
    signal.throwIfAborted();
    return await run(browser);
  } finally {
    signal.removeEventListener("abort", closeBrowser);
    await closeBrowser();
    releaseSlot();
  }
}
