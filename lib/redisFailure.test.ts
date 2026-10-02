import { beforeEach, describe, expect, it, vi } from "vitest";

const { boom } = vi.hoisted(() => ({
  boom: () => Promise.reject(new Error("getaddrinfo ENOTFOUND")),
}));

vi.mock("./kv", () => ({
  redis: {
    get: boom,
    set: boom,
    zremrangebyscore: boom,
    zcard: boom,
    zrange: boom,
    zadd: boom,
    expire: boom,
  },
}));

import { getCached, setCached } from "./cache";
import { checkRateLimit } from "./rateLimit";

describe("when Redis is configured but unreachable", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("cache falls back to memory instead of throwing", async () => {
    await expect(setCached("redis-down.example", { score: 7 })).resolves.toBeUndefined();
    expect(await getCached("redis-down.example")).toEqual({ score: 7 });
  });

  it("rate limit falls back to the in-memory limiter instead of throwing", async () => {
    const ip = "redis-down-1.2.3.4";
    for (let i = 0; i < 10; i++) {
      expect((await checkRateLimit(ip, 1_000_000 + i)).limited).toBe(false);
    }
    expect((await checkRateLimit(ip, 1_000_100)).limited).toBe(true);
  });
});
