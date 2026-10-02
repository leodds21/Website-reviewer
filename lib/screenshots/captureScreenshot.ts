import type { Browser, BrowserContext, Page } from "playwright-core";
import { HttpStatusError } from "../httpStatus";
import { SCREENSHOT_NAVIGATION_TIMEOUT_MS, SCREENSHOT_SETTLE_TIMEOUT_MS } from "../timeouts";
import type { ScreenshotViewport } from "./types";

type ViewportProfile = {
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  userAgent: (chromeMajor: string) => string;
};

// A generic modern phone and a common laptop size, not a specific
// device: enough for the site to pick its mobile/desktop layout.
// The user agents are the real Chrome ones (so sites serve their
// normal markup instead of a bot variant) plus our own identifying
// token, the same honesty rule as safeFetch's headers.
export const VIEWPORTS: Record<ScreenshotViewport, ViewportProfile> = {
  desktop: {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent: (major) =>
      `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36 lsdiasScan/1.0`,
  },
  mobile: {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: (major) =>
      `Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Mobile Safari/537.36 lsdiasScan/1.0`,
  },
};

export type CaptureOptions = {
  // Off by default: the report is about the first impression (header,
  // hero, main call to action). On, it captures the whole scrollable page.
  fullPage?: boolean;
  // Extension point for later page preparation, e.g. dismissing a
  // cookie banner. Deliberately unused for now: the capture shows what
  // a visitor sees on arrival, banners included.
  beforeCapture?: (page: Page) => Promise<void>;
};

// WebP at this quality keeps text and edges crisp for visual inspection
// at a fraction of PNG's size.
const WEBP_QUALITY = 80;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * After DOMContentLoaded, gives the page a bounded chance to finish
 * what shows up first: the window load event, web fonts, images inside
 * the first viewport (lazy ones included, since they're on screen), and
 * entrance animations (fade-ins caught halfway made a hero headline look
 * washed out). Infinite animations, like spinners, aren't waited on.
 * Never waits for the rest of the page or for network idle.
 */
async function settle(page: Page): Promise<void> {
  const aboveTheFold = page.evaluate(async () => {
    const pending = Array.from(document.images)
      .filter((image) => {
        if (image.complete) return false;
        const box = image.getBoundingClientRect();
        return box.bottom > 0 && box.right > 0 && box.top < window.innerHeight && box.left < window.innerWidth;
      })
      .map(
        (image) =>
          new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
      );
    await Promise.all([document.fonts?.ready, ...pending]);

    const finiteAnimations = document
      .getAnimations()
      .filter((animation) => animation.playState === "running" && Number.isFinite(animation.effect?.getComputedTiming().endTime));
    await Promise.all(finiteAnimations.map((animation) => animation.finished.catch(() => {})));
  });

  // A client-side redirect or reload destroys the evaluation context;
  // that's not a reason to give up on the capture.
  await Promise.race([
    Promise.all([page.waitForLoadState("load").catch(() => {}), aboveTheFold.catch(() => {})]),
    delay(SCREENSHOT_SETTLE_TIMEOUT_MS),
  ]);
  // One more beat for entrance animations and the final paint.
  await delay(300);
}

/**
 * Playwright's own screenshot only encodes PNG/JPEG; Chromium's
 * DevTools protocol encodes WebP directly, with no image library needed.
 */
async function captureWebp(context: BrowserContext, page: Page, fullPage: boolean): Promise<string> {
  const session = await context.newCDPSession(page);
  try {
    let clip: { x: number; y: number; width: number; height: number; scale: number } | undefined;
    if (fullPage) {
      const { cssContentSize } = await session.send("Page.getLayoutMetrics");
      clip = { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 };
    }
    const { data } = await session.send("Page.captureScreenshot", {
      format: "webp",
      quality: WEBP_QUALITY,
      captureBeyondViewport: fullPage,
      ...(clip ? { clip } : {}),
    });
    return data;
  } finally {
    await session.detach().catch(() => {});
  }
}

/**
 * Captures one viewport of `url` in its own browser context (isolated
 * cookies, storage and cache), returning the WebP as base64. The
 * context is always closed. Throws on navigation failure or an error
 * status, so the caller can classify why.
 */
export async function captureViewport(
  browser: Browser,
  url: string,
  viewport: ScreenshotViewport,
  options: CaptureOptions = {},
): Promise<string> {
  const profile = VIEWPORTS[viewport];
  const chromeMajor = browser.version().split(".")[0];

  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    userAgent: profile.userAgent(chromeMajor),
    locale: "pt-BR",
    // Sites that honor it skip entrance animations and render their
    // settled state, which is what a visitor sees a moment after arriving.
    reducedMotion: "reduce",
    serviceWorkers: "block",
    acceptDownloads: false,
  });

  try {
    const page = await context.newPage();
    // Popups opened by the page aren't part of the capture.
    context.on("page", (popup) => {
      if (popup !== page) void popup.close().catch(() => {});
    });

    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: SCREENSHOT_NAVIGATION_TIMEOUT_MS });
    if (response && response.status() >= 400) {
      throw new HttpStatusError(response.status(), `A página respondeu ${response.status()}.`);
    }

    await settle(page);
    await options.beforeCapture?.(page);
    return await captureWebp(context, page, options.fullPage ?? false);
  } finally {
    await context.close().catch(() => {});
  }
}
