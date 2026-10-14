import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeForBatch, runPool } from "./batchRun";
import type { AnalyzeReport } from "./report";

const REPORT = { domain: "a.com", checkedAt: "2026-10-14T00:00:00.000Z" } as AnalyzeReport;

function stream(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/event-stream" } });
}

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

describe("analyzeForBatch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the token and returns the final report", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(stream(frame("step", { step: "https" }) + frame("done", REPORT)));

    const outcome = await analyzeForBatch("a.com", "secret", new AbortController().signal);

    expect(outcome).toEqual({ ok: true, report: REPORT });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/analyze?url=a.com");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret");
  });

  it("returns the error code of a refused request", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ code: "unauthorized" }, { status: 401 }));

    expect(await analyzeForBatch("a.com", "wrong", new AbortController().signal)).toEqual({ ok: false, error: { code: "unauthorized" } });
  });

  it("returns a failed analysis's code", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(stream(frame("failed", { code: "site-blocked" })));

    expect(await analyzeForBatch("a.com", "t", new AbortController().signal)).toEqual({ ok: false, error: { code: "site-blocked" } });
  });

  it("keeps the partial report when Google's measurement never comes", async () => {
    const partial = { ...REPORT, inProgress: true } as AnalyzeReport;
    vi.mocked(fetch).mockResolvedValueOnce(stream(frame("partial", partial)));

    expect(await analyzeForBatch("a.com", "t", new AbortController().signal)).toEqual({ ok: true, report: partial });
  });
});

describe("runPool", () => {
  it("runs every item, never more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    const done: number[] = [];

    await runPool([1, 2, 3, 4, 5], 2, async (item) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      done.push(item);
      running--;
    });

    expect(done.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(2);
  });
});
