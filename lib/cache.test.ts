import { afterEach, describe, expect, it, vi } from "vitest";
import { getCached, setCached } from "./cache";

describe("cache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for a domain that was never cached", () => {
    expect(getCached("cache-test-empty.example")).toBeNull();
  });

  it("returns the cached value right after set", () => {
    setCached("cache-test-basic.example", { score: 42 });
    expect(getCached("cache-test-basic.example")).toEqual({ score: 42 });
  });

  it("keeps different domains isolated from each other", () => {
    setCached("cache-test-a.example", { score: 1 });
    expect(getCached("cache-test-b.example")).toBeNull();
  });

  it("expires exactly at the 6h TTL boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    setCached("cache-test-ttl.example", { score: 99 });

    vi.setSystemTime(new Date("2026-01-01T05:59:59Z"));
    expect(getCached("cache-test-ttl.example")).toEqual({ score: 99 });

    vi.setSystemTime(new Date("2026-01-01T06:00:01Z"));
    expect(getCached("cache-test-ttl.example")).toBeNull();
  });

  it("honors a custom TTL shorter than the default", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
    setCached("cache-test-short-ttl.example", { score: 50 }, 5 * 60 * 1000);

    vi.setSystemTime(new Date("2026-02-01T00:04:59Z"));
    expect(getCached("cache-test-short-ttl.example")).toEqual({ score: 50 });

    vi.setSystemTime(new Date("2026-02-01T00:05:01Z"));
    expect(getCached("cache-test-short-ttl.example")).toBeNull();
  });

  it("evicts the oldest entries once the cap is exceeded", () => {
    // MAX_ENTRIES is 1000; fill well past it (a couple hundred entries
    // of margin over the cap, since a handful of keys already exist
    // from earlier tests in this file and are themselves older) so the
    // very first keys set here are guaranteed to be among whatever
    // gets evicted, without depending on the exact pre-existing count.
    for (let i = 0; i < 1200; i++) {
      setCached(`cache-test-evict-${i}.example`, { i });
    }

    expect(getCached("cache-test-evict-0.example")).toBeNull(); // long evicted
    expect(getCached("cache-test-evict-1199.example")).toEqual({ i: 1199 }); // newest, kept
  });
});
