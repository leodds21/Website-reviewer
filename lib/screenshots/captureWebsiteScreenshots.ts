import { classifyCheckFailure, type FailureReason } from "../checkFailure";
import { assertHostAllowed } from "../safeFetch";
import { SCREENSHOT_TIMEOUT_MS } from "../timeouts";
import { withBrowser } from "./browser";
import { VIEWPORTS, captureViewport } from "./captureScreenshot";
import { proxyLaunchArgs, startEgressProxy } from "./egressProxy";
import { storeScreenshot } from "./store";
import type { Screenshot, ScreenshotViewport, WebsiteScreenshots } from "./types";

function failed(viewport: ScreenshotViewport, reason: FailureReason): Screenshot {
  const { width, height } = VIEWPORTS[viewport];
  return { status: "failed", width, height, reason };
}

// Once our own time budget runs out, the browser is torn down and every
// pending call rejects with "target closed": the real reason is the abort.
function reasonFor(error: unknown, signal: AbortSignal): FailureReason {
  return classifyCheckFailure(signal.aborted ? signal.reason : error);
}

/**
 * Desktop and mobile captures of `url`'s first viewport. Never throws:
 * a site that can't be captured (blocked, slow, unreachable, a browser
 * crash) yields per-viewport "failed" entries with a reason, and the
 * rest of the analysis carries on. Both viewports share one browser,
 * each in its own context, captured in parallel.
 */
export async function captureWebsiteScreenshots(url: string, signal?: AbortSignal): Promise<WebsiteScreenshots> {
  const timeout = AbortSignal.timeout(SCREENSHOT_TIMEOUT_MS);
  const budget = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let proxy: Awaited<ReturnType<typeof startEgressProxy>> | undefined;
  try {
    // Same SSRF rules as every other check, before any browser exists:
    // an internal or malformed target fails here without launching one.
    await assertHostAllowed(new URL(url));
    // Everything the browser connects to afterwards (redirects,
    // subresources) is checked again by the egress proxy.
    proxy = await startEgressProxy();

    return await withBrowser(budget, proxyLaunchArgs(proxy), async (browser) => {
      const viewports: ScreenshotViewport[] = ["desktop", "mobile"];
      const captures = await Promise.allSettled(viewports.map((viewport) => captureViewport(browser, url, viewport)));

      const entries = await Promise.all(
        captures.map(async (capture, index): Promise<[ScreenshotViewport, Screenshot]> => {
          const viewport = viewports[index];
          if (capture.status === "rejected") {
            console.error(`Captura ${viewport} falhou para ${url}:`, capture.reason);
            return [viewport, failed(viewport, reasonFor(capture.reason, budget))];
          }
          const { width, height } = VIEWPORTS[viewport];
          return [viewport, { status: "success", width, height, src: await storeScreenshot(capture.value) }];
        }),
      );

      return Object.fromEntries(entries) as WebsiteScreenshots;
    });
  } catch (error) {
    console.error(`Capturas falharam para ${url}:`, error);
    const reason = reasonFor(error, budget);
    return { desktop: failed("desktop", reason), mobile: failed("mobile", reason) };
  } finally {
    await proxy?.close();
  }
}
