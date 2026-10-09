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

    for (let i = 0; i < 10; i++) await checkRateLimit(targetIp, start + i);
    expect((await checkRateLimit(targetIp, start + 10)).limited).toBe(true);

    // Past MAX_TRACKED_IPS (5000), with margin for IPs from earlier tests.
    for (let i = 0; i < 5200; i++) {
      await checkRateLimit(`rate-limit-test-evict-filler-${i}.ip`, start + 20 + i);
    }

    expect((await checkRateLimit(targetIp, start + 5300)).limited).toBe(false);
  });
});

describe("checkRateLimit (Upstash Redis path)", () => {
  // A sorted-set store behind multi()/exec(), run in order like MULTI.
  function mockRedis() {
    const store = new Map<string, Map<string, number>>();
    const commands = {
      zremrangebyscore: (key: string, _min: number, max: number) => {
        const set = store.get(key);
        if (set) for (const [member, score] of set) if (score <= max) set.delete(member);
        return 0;
      },
      zadd: (key: string, entry: { score: number; member: string }) => {
        if (!store.has(key)) store.set(key, new Map());
        store.get(key)!.set(entry.member, entry.score);
        return 1;
      },
      zcard: (key: string) => store.get(key)?.size ?? 0,
      zrange: (key: string) => {
        const set = store.get(key);
        if (!set || set.size === 0) return [];
        const [member, score] = [...set.entries()].sort((a, b) => a[1] - b[1])[0];
        return [member, score];
      },
      pexpire: () => 1,
    };

    return {
      multi() {
        const queued: (() => unknown)[] = [];
        const chain = Object.fromEntries(
          Object.entries(commands).map(([name, run]) => [
            name,
            (...args: unknown[]) => {
              queued.push(() => (run as (...a: unknown[]) => unknown)(...args));
              return chain;
            },
          ]),
        ) as Record<string, (...args: unknown[]) => unknown> & { exec?: () => Promise<unknown[]> };
        chain.exec = async () => queued.map((command) => command());
        return chain;
      },
      zrem: vi.fn(async (key: string, member: string) => (store.get(key)?.delete(member) ? 1 : 0)),
      size: (key: string) => store.get(key)?.size ?? 0,
    };
  }

  it("allows the first 10 requests, blocks the 11th, using the real retry time from the oldest entry", async () => {
    vi.resetModules();
    const redis = mockRedis();
    vi.doMock("./kv", () => ({ redis }));
    const { checkRateLimit: checkRateLimitRedis } = await import("./rateLimit");

    const ip = "redis-rate-limit-test.ip";
    for (let i = 0; i < 10; i++) {
      expect((await checkRateLimitRedis(ip, start + i * 1000)).limited).toBe(false);
    }

    const eleventh = await checkRateLimitRedis(ip, start + 10_000);
    expect(eleventh.limited).toBe(true);
    // A refused request is taken back out, so it doesn't count later.
    expect(redis.size(`ratelimit:${ip}`)).toBe(10);
    if (eleventh.limited) {
      expect(eleventh.retryAfterSeconds).toBe(Math.ceil((ONE_HOUR_MS - 10_000) / 1000));
    }

    vi.doUnmock("./kv");
    vi.resetModules();
  });

  it("still refuses an over-limit request when taking it back out of Redis fails", async () => {
    vi.resetModules();
    const redis = mockRedis();
    redis.zrem.mockRejectedValue(new Error("connection reset"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.doMock("./kv", () => ({ redis }));
    const { checkRateLimit: checkRateLimitRedis } = await import("./rateLimit");

    const ip = "redis-rate-limit-cleanup.ip";
    for (let i = 0; i < 10; i++) await checkRateLimitRedis(ip, start + i);

    // A failed cleanup must not fall back to the (empty) in-memory limiter.
    expect((await checkRateLimitRedis(ip, start + 100)).limited).toBe(true);

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
