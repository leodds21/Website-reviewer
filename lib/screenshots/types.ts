import type { FailureReason } from "../checkFailure";

export type ScreenshotViewport = "desktop" | "mobile";

// width/height are the CSS viewport the page was rendered at (what the
// visitor's screen would show), not the image's pixel size: the mobile
// capture is taken at deviceScaleFactor 2 for a sharp image.
export type Screenshot =
  | { status: "success"; width: number; height: number; src: string }
  | { status: "failed"; width: number; height: number; reason: FailureReason };

export type WebsiteScreenshots = Record<ScreenshotViewport, Screenshot>;
