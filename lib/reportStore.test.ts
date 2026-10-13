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
