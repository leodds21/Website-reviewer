import { describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "./rateLimit";

const ONE_HOUR_MS = 60 * 60 * 1000;
const start = 1_000_000;

describe("checkRateLimit (in-memory fallback — no Upstash env vars set in this test run)", () => {
  it("allows the first 10 requests in a window, then blocks the 11th", async () => {
    const ip = "rate-limit-test-1.2.3.4";

    for (let i = 0; i < 10; i++) {
      expect((await checkRateLimit(ip, start + i * 1000)).limited).toBe(false);
    }

    const eleventh = await checkRateLimit(ip, start + 10_000);
    expect(eleventh.limited).toBe(true);
    if (eleventh.limited) {
      expect(eleventh.retryAfterSeconds).toBeGreaterThan(0);
      expect(eleventh.retryAfterSeconds).toBeLessThanOrEqual(3600);
    }
  });

  it("tracks each IP independently", async () => {
    const busyIp = "rate-limit-test-busy.ip";
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(busyIp, start + i * 1000);
    }

    expect((await checkRateLimit("rate-limit-test-other.ip", start + 10_000)).limited).toBe(false);
  });

  it("allows requests again once the window has passed", async () => {
    const ip = "rate-limit-test-window.ip";
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(ip, start + i * 1000);
    }

    expect((await checkRateLimit(ip, start + ONE_HOUR_MS + 1000)).limited).toBe(false);
  });

  it("evicts the oldest tracked IPs once MAX_TRACKED_IPS is exceeded", async () => {
    const targetIp = "rate-limit-test-evict-target.ip";

    // Max the target out and confirm the baseline: with its history
    // intact, an 11th request within the window is still limited.
    for (let i = 0; i < 10; i++) await checkRateLimit(targetIp, start + i);
    expect((await checkRateLimit(targetIp, start + 10)).limited).toBe(true);

    // Flood past MAX_TRACKED_IPS (5000) with other IPs — the target,
    // being the oldest entry, should be the first evicted. A 200-IP
    // margin absorbs whatever handful of IPs earlier tests already
    // registered, so this doesn't depend on the exact prior count.
    for (let i = 0; i < 5200; i++) {
      await checkRateLimit(`rate-limit-test-evict-filler-${i}.ip`, start + 20 + i);
    }

    // Still well within the same 1h window — if the target's history
    // survived, this would still be limited. It isn't, because
    // eviction wiped it, same as an IP never seen before.
    expect((await checkRateLimit(targetIp, start + 5300)).limited).toBe(false);
  });
});

describe("checkRateLimit (Upstash Redis path)", () => {
  // Same reason as cache.test.ts: lib/kv.ts picks in-memory vs Redis
  // once at module load from env vars, so the Redis branch is
  // exercised by mocking that module, not by setting env vars.
  function mockRedis() {
    const store = new Map<string, Map<string, number>>();

    return {
      zremrangebyscore: vi.fn(async (key: string, _min: number, max: number) => {
        const set = store.get(key);
        if (!set) return 0;
        for (const [member, score] of set) if (score <= max) set.delete(member);
        return 0;
      }),
      zcard: vi.fn(async (key: string) => store.get(key)?.size ?? 0),
      zadd: vi.fn(async (key: string, entry: { score: number; member: string }) => {
        if (!store.has(key)) store.set(key, new Map());
        store.get(key)!.set(entry.member, entry.score);
        return 1;
      }),
      zrange: vi.fn(async (key: string) => {
        const set = store.get(key);
        if (!set || set.size === 0) return [];
        const [member, score] = [...set.entries()].sort((a, b) => a[1] - b[1])[0];
        return [member, score];
      }),
      expire: vi.fn(async () => 1),
    };
  }

  it("allows the first 10 requests, blocks the 11th, using the real retry time from the oldest entry", async () => {
    vi.resetModules();
    vi.doMock("./kv", () => ({ redis: mockRedis() }));
    const { checkRateLimit: checkRateLimitRedis } = await import("./rateLimit");

    const ip = "redis-rate-limit-test.ip";
    for (let i = 0; i < 10; i++) {
      expect((await checkRateLimitRedis(ip, start + i * 1000)).limited).toBe(false);
    }

    const eleventh = await checkRateLimitRedis(ip, start + 10_000);
    expect(eleventh.limited).toBe(true);
    if (eleventh.limited) {
      // The oldest request was at `start`; the window closes on it at
      // start + WINDOW_MS, and we're asking at start + 10_000.
      expect(eleventh.retryAfterSeconds).toBe(Math.ceil((ONE_HOUR_MS - 10_000) / 1000));
    }

    vi.doUnmock("./kv");
    vi.resetModules();
  });

  it("prunes entries outside the window instead of counting them", async () => {
    vi.resetModules();
    vi.doMock("./kv", () => ({ redis: mockRedis() }));
    const { checkRateLimit: checkRateLimitRedis } = await import("./rateLimit");

    const ip = "redis-rate-limit-window-test.ip";
    for (let i = 0; i < 10; i++) await checkRateLimitRedis(ip, start + i);

    // Well past the window — every earlier entry should have aged out.
    expect((await checkRateLimitRedis(ip, start + ONE_HOUR_MS + 1000)).limited).toBe(false);

    vi.doUnmock("./kv");
    vi.resetModules();
  });
});
