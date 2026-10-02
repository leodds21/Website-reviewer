import { useEffect, useRef, useState } from "react";

// How much of the remaining distance to 100 the bar may cover purely
// on elapsed time, while it waits for the next real step. Below 1 so
// the bar can never claim to be finished before the checks say so.
const CREEP_SHARE = 0.8;

// Time constant of that creep. The bar moves at a decent clip right
// after a step lands and slows down the longer nothing new arrives,
// but never stops, so a 30s PageSpeed wait still looks alive without
// ever reaching the ceiling.
const CREEP_TAU_MS = 10_000;

// How quickly the displayed value catches up with the target. Short
// enough that a real step is felt almost at once, long enough that a
// big jump (several fast checks landing together) reads as a glide.
const EASE_TAU_MS = 500;

// A backgrounded tab pauses animation frames; without a cap, the first
// frame back would see a huge dt and snap the bar to its target.
const MAX_FRAME_MS = 100;

/**
 * One animation step. Pure so the curve can be tested without a clock.
 * The target is the real progress plus a slow creep toward a ceiling
 * below 100 (restarted by every real step), and the displayed value
 * eases toward it, never moving backwards.
 */
export function advanceProgress(shown: number, real: number, sinceStepMs: number, dtMs: number): number {
  const target = real >= 100 ? 100 : real + (100 - real) * CREEP_SHARE * (1 - Math.exp(-sinceStepMs / CREEP_TAU_MS));
  const eased = shown + (target - shown) * (1 - Math.exp(-Math.min(dtMs, MAX_FRAME_MS) / EASE_TAU_MS));
  return Math.max(shown, eased);
}

/** Smoothly animated 0-100 value that follows `realPercent` without jumping or stalling. */
export function useSmoothProgress(realPercent: number): number {
  const [shown, setShown] = useState(0);
  const state = useRef({ shown: 0, real: realPercent, stepAt: 0, lastFrame: 0 });

  useEffect(() => {
    state.current.real = realPercent;
    state.current.stepAt = performance.now();
  }, [realPercent]);

  useEffect(() => {
    const current = state.current;
    current.stepAt = current.lastFrame = performance.now();

    let frame = requestAnimationFrame(function tick(now) {
      current.shown = advanceProgress(current.shown, current.real, now - current.stepAt, now - current.lastFrame);
      current.lastFrame = now;
      // One decimal is finer than a pixel on this bar, and lets React
      // skip the render on frames where nothing visibly moved.
      setShown(Math.round(current.shown * 10) / 10);
      frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return shown;
}
