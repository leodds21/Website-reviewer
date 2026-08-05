import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rateLimit";

const ONE_HOUR_MS = 60 * 60 * 1000;
const start = 1_000_000;

describe("checkRateLimit", () => {
  it("allows the first 10 requests in a window, then blocks the 11th", () => {
    const ip = "rate-limit-test-1.2.3.4";

    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(ip, start + i * 1000).limited).toBe(false);
    }

    const eleventh = checkRateLimit(ip, start + 10_000);
    expect(eleventh.limited).toBe(true);
    if (eleventh.limited) {
      expect(eleventh.retryAfterSeconds).toBeGreaterThan(0);
      expect(eleventh.retryAfterSeconds).toBeLessThanOrEqual(3600);
    }
  });

  it("tracks each IP independently", () => {
    const busyIp = "rate-limit-test-busy.ip";
    for (let i = 0; i < 10; i++) {
      checkRateLimit(busyIp, start + i * 1000);
    }

    expect(checkRateLimit("rate-limit-test-other.ip", start + 10_000).limited).toBe(false);
  });

  it("allows requests again once the window has passed", () => {
    const ip = "rate-limit-test-window.ip";
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip, start + i * 1000);
    }

    expect(checkRateLimit(ip, start + ONE_HOUR_MS + 1000).limited).toBe(false);
  });
});
