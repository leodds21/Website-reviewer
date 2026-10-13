import { describe, expect, it } from "vitest";
import { redisError } from "./kv";

describe("redisError", () => {
  it("keeps the error but drops the command Upstash appends", () => {
    const error = new Error('ERR max requests limit exceeded, command was: [["zadd","ratelimit:203.0.113.7",{"score":1}]]');

    expect(redisError(error)).toBe("Error: ERR max requests limit exceeded");
    expect(redisError(error)).not.toContain("203.0.113.7");
  });

  it("leaves other errors as they are", () => {
    expect(redisError(new TypeError("fetch failed"))).toBe("TypeError: fetch failed");
  });
});
