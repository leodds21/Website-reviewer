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
});
