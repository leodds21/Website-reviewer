import { afterEach, describe, expect, it, vi } from "vitest";
import { analysisInFlight, claimAnalysis, followAnalysis, setInflightStore, type Snapshot } from "./inflight";
import type { AnalyzeReport } from "./report";

const REPORT = { domain: "x.com" } as AnalyzeReport;

function follow(key: string, overrides: Partial<Parameters<typeof followAnalysis>[1]> = {}) {
  const snapshots: Snapshot[] = [];
  const outcome = followAnalysis(key, {
    signal: new AbortController().signal,
    deadline: Date.now() + 5000,
    onSnapshot: (snapshot) => snapshots.push(snapshot),
    pollMs: 5,
    ...overrides,
  });
  return { outcome, snapshots };
}

afterEach(() => {
  setInflightStore(null);
  vi.useRealTimers();
});

describe("claimAnalysis", () => {
  it("lets one request lead a URL at a time, and frees it when the leader finishes", async () => {
    const leader = await claimAnalysis("lead-once");

    expect(leader).not.toBeNull();
    expect(await claimAnalysis("lead-once")).toBeNull();
    expect(await analysisInFlight("lead-once")).toBe(true);

    await leader!.finish({ steps: [], final: REPORT });

    expect(await analysisInFlight("lead-once")).toBe(false);
    expect(await claimAnalysis("lead-once")).not.toBeNull();
  });

  it("frees a lock nobody released once it expires", async () => {
    vi.useFakeTimers();
    await claimAnalysis("expires");

    vi.advanceTimersByTime(76_000);

    expect(await claimAnalysis("expires")).not.toBeNull();
  });

  it("never frees a lock a newer leader took after the old one expired", async () => {
    vi.useFakeTimers();
    const stale = await claimAnalysis("stale-release");
    vi.advanceTimersByTime(76_000);
    await claimAnalysis("stale-release");

    await stale!.finish({ steps: [], final: REPORT });

    expect(await analysisInFlight("stale-release")).toBe(true);
  });

  it("runs uncoalesced instead of failing when the store is down", async () => {
    const down = () => Promise.reject(new Error("connection reset"));
    setInflightStore({ claim: down, owner: down, read: down, write: down, release: down });
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await analysisInFlight("store-down")).toBe(false);
    const leader = await claimAnalysis("store-down");
    expect(leader).not.toBeNull();
    leader!.publish({ steps: ["https"] });
    await expect(leader!.finish({ steps: ["https"], final: REPORT })).resolves.toBeUndefined();
  });
});

describe("followAnalysis", () => {
  it("relays the leader's progress and ends with its report", async () => {
    const leader = await claimAnalysis("relay");
    leader!.publish({ steps: ["https"] });
    const { outcome, snapshots } = follow("relay");

    await vi.waitFor(() => expect(snapshots.length).toBeGreaterThan(0));
    await leader!.finish({ steps: ["https", "pagespeed"], final: REPORT });

    expect(await outcome).toEqual({ kind: "final", report: REPORT });
    expect(snapshots.at(-1)?.steps).toEqual(["https", "pagespeed"]);
  });

  it("passes on the leader's failure code", async () => {
    const leader = await claimAnalysis("relay-failure");
    const { outcome } = follow("relay-failure");
    await leader!.finish({ steps: [], failed: "site-blocked" });

    expect(await outcome).toEqual({ kind: "failed", code: "site-blocked" });
  });

  it("reports the analysis as orphaned when the leader's visitor left", async () => {
    const leader = await claimAnalysis("orphaned");
    const { outcome } = follow("orphaned");
    await leader!.finish({ steps: ["https"], aborted: true });

    expect(await outcome).toEqual({ kind: "orphaned" });
  });

  it("reports orphaned right away when nothing is running", async () => {
    expect(await follow("nothing-running").outcome).toEqual({ kind: "orphaned" });
  });

  it("gives up at its own deadline", async () => {
    await claimAnalysis("deadline");

    expect(await follow("deadline", { deadline: Date.now() + 20 }).outcome).toEqual({ kind: "timeout" });
  });

  it("stops polling when its own visitor leaves", async () => {
    await claimAnalysis("follower-left");
    const controller = new AbortController();
    const { outcome } = follow("follower-left", { signal: controller.signal });

    controller.abort();

    expect(await outcome).toEqual({ kind: "aborted" });
  });

  it("fails after repeated store errors instead of polling forever", async () => {
    await claimAnalysis("flaky");
    const reads = vi.fn().mockRejectedValue(new Error("timeout"));
    setInflightStore({
      claim: async () => true,
      owner: async () => "run",
      read: reads,
      write: async () => {},
      release: async () => {},
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await follow("flaky").outcome).toEqual({ kind: "failed", code: "analysis-failed" });
    expect(reads).toHaveBeenCalledTimes(3);
  });
});
