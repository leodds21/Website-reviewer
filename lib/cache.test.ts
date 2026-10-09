import { afterEach, describe, expect, it, vi } from "vitest";
import { getCached, setCached } from "./cache";

describe("cache (in-memory fallback — no Upstash env vars set in this test run)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for a domain that was never cached", async () => {
    expect(await getCached("cache-test-empty.example")).toBeNull();
  });

  it("returns the cached value right after set", async () => {
    await setCached("cache-test-basic.example", { score: 42 });
    expect(await getCached("cache-test-basic.example")).toEqual({ score: 42 });
  });

  it("keeps different domains isolated from each other", async () => {
    await setCached("cache-test-a.example", { score: 1 });
    expect(await getCached("cache-test-b.example")).toBeNull();
  });

  it("expires exactly at the 6h TTL boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await setCached("cache-test-ttl.example", { score: 99 });

    vi.setSystemTime(new Date("2026-01-01T05:59:59Z"));
    expect(await getCached("cache-test-ttl.example")).toEqual({ score: 99 });

    vi.setSystemTime(new Date("2026-01-01T06:00:01Z"));
    expect(await getCached("cache-test-ttl.example")).toBeNull();
  });

  it("honors a custom TTL shorter than the default", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
    await setCached("cache-test-short-ttl.example", { score: 50 }, 5 * 60 * 1000);

    vi.setSystemTime(new Date("2026-02-01T00:04:59Z"));
    expect(await getCached("cache-test-short-ttl.example")).toEqual({ score: 50 });

    vi.setSystemTime(new Date("2026-02-01T00:05:01Z"));
    expect(await getCached("cache-test-short-ttl.example")).toBeNull();
  });

  it("evicts the oldest entries once the cap is exceeded", async () => {
    // Past MAX_ENTRIES (1000) with margin for keys from earlier tests.
    for (let i = 0; i < 1200; i++) {
      await setCached(`cache-test-evict-${i}.example`, { i });
    }

    expect(await getCached("cache-test-evict-0.example")).toBeNull(); // long evicted
    expect(await getCached("cache-test-evict-1199.example")).toEqual({ i: 1199 }); // newest, kept
  });

  it("treats a refreshed key as recently used, not as the oldest", async () => {
    await setCached("keep-me", 1);
    for (let index = 0; index < 1200; index++) await setCached(`filler-${index}`, index);
    await setCached("keep-me", 2); // refreshed, so it should survive the next sweep
    for (let index = 1200; index < 1400; index++) await setCached(`filler-${index}`, index);

    expect(await getCached("keep-me")).toBe(2);
  });
});

describe("cache (Upstash Redis path)", () => {
  // lib/kv.ts picks Redis at module load, so the module is mocked.
  it("reads and writes through the Redis client, with px as the millisecond TTL", async () => {
    vi.resetModules();
    const get = vi.fn().mockResolvedValue({ score: 7 });
    const set = vi.fn().mockResolvedValue("OK");
    vi.doMock("./kv", () => ({ redis: { get, set } }));

    const redisBackedCache = await import("./cache");
    await redisBackedCache.setCached("redis-test.example", { score: 7 }, 12345);
    const result = await redisBackedCache.getCached("redis-test.example");

    expect(set).toHaveBeenCalledWith("redis-test.example", { score: 7 }, { px: 12345 });
    expect(get).toHaveBeenCalledWith("redis-test.example");
    expect(result).toEqual({ score: 7 });

    vi.doUnmock("./kv");
    vi.resetModules();
  });

  it("returns null, not undefined, for a Redis miss", async () => {
    vi.resetModules();
    vi.doMock("./kv", () => ({ redis: { get: vi.fn().mockResolvedValue(undefined), set: vi.fn() } }));

    const redisBackedCache = await import("./cache");
    expect(await redisBackedCache.getCached("redis-test-miss.example")).toBeNull();

    vi.doUnmock("./kv");
    vi.resetModules();
  });
});
