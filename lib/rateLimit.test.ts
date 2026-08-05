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

  it("evicts the oldest tracked IPs once MAX_TRACKED_IPS is exceeded", () => {
    const targetIp = "rate-limit-test-evict-target.ip";

    // Max the target out and confirm the baseline: with its history
    // intact, an 11th request within the window is still limited.
    for (let i = 0; i < 10; i++) checkRateLimit(targetIp, start + i);
    expect(checkRateLimit(targetIp, start + 10).limited).toBe(true);

    // Flood past MAX_TRACKED_IPS (5000) with other IPs — the target,
    // being the oldest entry, should be the first evicted. A 200-IP
    // margin absorbs whatever handful of IPs earlier tests already
    // registered, so this doesn't depend on the exact prior count.
    for (let i = 0; i < 5200; i++) {
      checkRateLimit(`rate-limit-test-evict-filler-${i}.ip`, start + 20 + i);
    }

    // Still well within the same 1h window — if the target's history
    // survived, this would still be limited. It isn't, because
    // eviction wiped it, same as an IP never seen before.
    expect(checkRateLimit(targetIp, start + 5300).limited).toBe(false);
  });
});
