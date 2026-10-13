import { describe, expect, it } from "vitest";
import { buildReport } from "./buildReport";
import { SCORE_SCENARIOS } from "./scoreScenarios";

const base = { domain: "x.com", platform: null, checkedAt: "2026-10-13T12:00:00.000Z" } as const;

describe("buildReport", () => {
  it("marks a report built while checks are pending as in progress", () => {
    const { input, failures } = SCORE_SCENARIOS.average;
    const report = buildReport({ ...base, results: input, failures, pending: ["pagespeed"] });

    expect(report.inProgress).toBe(true);
    expect(report.score.overallSeverity).toBe("pendente");
  });

  it("leaves the final report without the in-progress flag", () => {
    const { input, failures } = SCORE_SCENARIOS.average;
    const report = buildReport({ ...base, results: input, failures });

    expect(report).not.toHaveProperty("inProgress");
    expect(report.score.overall).toBe(73);
  });

  it("flags a report as blocked when any check was refused", () => {
    const { input, failures } = SCORE_SCENARIOS.blocked;

    expect(buildReport({ ...base, results: input, failures }).blocked).toBe(true);
  });
});
