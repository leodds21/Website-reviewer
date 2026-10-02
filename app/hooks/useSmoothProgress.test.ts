import { describe, expect, it } from "vitest";
import { advanceProgress } from "./useSmoothProgress";

// Runs the curve forward in 16ms frames, like requestAnimationFrame would.
function simulate(startShown: number, real: number, seconds: number, sinceStepMs = 0): number {
  let shown = startShown;
  for (let t = 0; t < seconds * 1000; t += 16) {
    shown = advanceProgress(shown, real, sinceStepMs + t, 16);
  }
  return shown;
}

describe("advanceProgress", () => {
  it("keeps moving while waiting on a slow check, instead of stalling", () => {
    const at5s = simulate(40, 40, 5);
    const at15s = simulate(40, 40, 15);
    const at30s = simulate(40, 40, 30);

    expect(at5s).toBeGreaterThan(40);
    expect(at15s).toBeGreaterThan(at5s);
    expect(at30s).toBeGreaterThan(at15s);
  });

  it("never claims to be finished before the real progress is", () => {
    expect(simulate(40, 40, 120)).toBeLessThan(40 + 60 * 0.8 + 0.01);
    expect(simulate(0, 0, 120)).toBeLessThan(81);
  });

  it("glides toward a real jump instead of snapping to it", () => {
    const oneFrame = advanceProgress(10, 70, 0, 16);

    expect(oneFrame).toBeGreaterThan(10);
    expect(oneFrame).toBeLessThan(12);
    expect(simulate(10, 70, 3)).toBeGreaterThan(65);
  });

  it("never moves backwards, even if the target drops below what's shown", () => {
    expect(advanceProgress(60, 20, 0, 16)).toBe(60);
  });

  it("does not leap after a long gap between frames (backgrounded tab)", () => {
    const after = advanceProgress(10, 70, 0, 60_000);

    expect(after).toBeLessThan(10 + 60 * 0.2);
  });

  it("reaches 100 once every real step is done", () => {
    expect(simulate(90, 100, 5)).toBeGreaterThan(99.9);
  });
});
