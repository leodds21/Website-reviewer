import { afterEach, describe, expect, it, vi } from "vitest";
import { getStoredReport, reportTtlMs, saveReport } from "./reportStore";
import type { AnalyzeReport } from "./report";

const REPORT = { domain: "x.com", checkedAt: "2026-10-13T12:00:00.000Z" } as AnalyzeReport;
const DAY = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("reportStore (in memory, no Redis in tests)", () => {
  it("stores a versioned record with the id inside the report", async () => {
    const stored = await saveReport(REPORT, "https://x.com/", 0);

    expect(stored).toMatchObject({ version: 1, domain: "x.com", targetUrl: "https://x.com/", createdAt: new Date(0).toISOString() });
    expect(stored.report.id).toBe(stored.id);
    expect(await getStoredReport(stored.id, 1)).toEqual(stored);
  });

  it("treats an expired report as gone", async () => {
    const stored = await saveReport(REPORT, "https://x.com/", 0);

    expect(await getStoredReport(stored.id, 31 * DAY)).toBeNull();
  });

  it("returns null for a malformed or unknown id without looking it up", async () => {
    expect(await getStoredReport("../../etc")).toBeNull();
    expect(await getStoredReport("abcDEF1234")).toBeNull();
  });

  it("keeps reports 30 days unless REPORT_TTL_DAYS says otherwise, within sane bounds", () => {
    expect(reportTtlMs()).toBe(30 * DAY);
    vi.stubEnv("REPORT_TTL_DAYS", "7");
    expect(reportTtlMs()).toBe(7 * DAY);
    vi.stubEnv("REPORT_TTL_DAYS", "0");
    expect(reportTtlMs()).toBe(30 * DAY);
    vi.stubEnv("REPORT_TTL_DAYS", "not a number");
    expect(reportTtlMs()).toBe(30 * DAY);
  });
});

describe("reportStore with Redis", () => {
  async function storeWith(redis: object) {
    vi.resetModules();
    vi.doMock("./kv", async (importOriginal) => ({ ...(await importOriginal<typeof import("./kv")>()), redis }));
    return import("./reportStore");
  }

  afterEach(() => {
    vi.doUnmock("./kv");
    vi.resetModules();
  });

  it("fails the save when Redis does, instead of keeping a copy only this instance can serve", async () => {
    const { saveReport } = await storeWith({ set: () => Promise.reject(new Error("timeout")) });

    await expect(saveReport(REPORT, "https://x.com/")).rejects.toThrow("timeout");
  });

  it("treats a failed read as an error, not as an expired report", async () => {
    const { getStoredReport } = await storeWith({ get: () => Promise.reject(new Error("connection reset, command was: [\"get\"]")) });

    await expect(getStoredReport("abcDEF1234")).rejects.toThrow("Redis read failed: Error: connection reset");
  });

  it("returns null for a report Redis doesn't have", async () => {
    const { getStoredReport } = await storeWith({ get: async () => null });

    expect(await getStoredReport("abcDEF1234")).toBeNull();
  });

  it("stores with a whole-millisecond TTL, even for a fractional REPORT_TTL_DAYS", async () => {
    vi.stubEnv("REPORT_TTL_DAYS", "1.1");
    const set = vi.fn<(...args: unknown[]) => Promise<string>>(async () => "OK");
    const { saveReport } = await storeWith({ set });

    await saveReport(REPORT, "https://x.com/");

    const options = set.mock.calls[0][2] as { px: number };
    expect(Number.isInteger(options.px)).toBe(true);
  });
});
