import type { Browser } from "playwright-core";

// A cold start on serverless includes unpacking Chromium into /tmp;
// past this something is wrong, and the capture budget is better spent
// failing fast than waiting on Playwright's 3-minute default.
const LAUNCH_TIMEOUT_MS = 15000;

/**
 * Starts a headless Chromium suited to where the code is running.
 *
 * On Vercel (and any AWS Lambda-like runtime) the full Playwright
 * Chromium doesn't fit a function bundle, so it uses @sparticuz/chromium:
 * a brotli-packed build made for serverless, unpacked into /tmp on
 * first use. Locally it uses CHROMIUM_EXECUTABLE_PATH when set,
 * otherwise the installed Google Chrome.
 */
export async function launchBrowser(extraArgs: string[] = []): Promise<Browser> {
  // Loaded on first capture, not with the route: if the browser stack
  // can't load in some environment, only the preview fails (and says
  // so), never the whole analysis endpoint.
  const { chromium } = await import("playwright-core");

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const { default: serverlessChromium } = await import("@sparticuz/chromium");
    // No WebGL needed for a static capture; skips unpacking swiftshader.
    serverlessChromium.setGraphicsMode = false;
    return chromium.launch({
      executablePath: await serverlessChromium.executablePath(),
      args: [...serverlessChromium.args, ...extraArgs],
      headless: true,
      timeout: LAUNCH_TIMEOUT_MS,
    });
  }

  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  return chromium.launch({
    ...(executablePath ? { executablePath } : { channel: "chrome" }),
    args: extraArgs,
    headless: true,
    timeout: LAUNCH_TIMEOUT_MS,
  });
}
