import { describe, expect, it } from "vitest";
import { isReportId, newReportId } from "./reportId";

describe("report ids", () => {
  it("are 10 URL-safe characters", () => {
    expect(newReportId()).toMatch(/^[0-9A-Za-z]{10}$/);
  });

  it("don't repeat", () => {
    const ids = new Set(Array.from({ length: 5000 }, newReportId));
    expect(ids.size).toBe(5000);
  });

  it("use the whole alphabet, not a biased part of it", () => {
    const seen = new Set(Array.from({ length: 2000 }, newReportId).join(""));
    expect(seen.size).toBe(62);
  });

  it("reject anything that could reach the store as a crafted key", () => {
    expect(isReportId("abcDEF1234")).toBe(true);
    for (const bad of ["", "short", "abcDEF12345", "abc/EF1234", "../etc/pas", "abcDEF123*"]) expect(isReportId(bad)).toBe(false);
  });
});
