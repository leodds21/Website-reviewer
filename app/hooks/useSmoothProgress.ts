import { useEffect, useRef, useState } from "react";

// While waiting for a step, the bar creeps over part of the remaining
// distance. Below 1, so it never reaches 100 before the checks do.
const CREEP_SHARE = 0.8;
const CREEP_TAU_MS = 10_000;

const EASE_TAU_MS = 500;

// Easing only approaches 100, so snap once close.
const FINISH_EASE_TAU_MS = 100;
const FINISH_SNAP = 0.5;

// A background tab pauses frames; the first one back would otherwise jump.
const MAX_FRAME_MS = 100;

// Pure, so the curve can be tested without a clock.
export function advanceProgress(shown: number, real: number, sinceStepMs: number, dtMs: number): number {
  const target = real >= 100 ? 100 : real + (100 - real) * CREEP_SHARE * (1 - Math.exp(-sinceStepMs / CREEP_TAU_MS));
  const tau = real >= 100 ? FINISH_EASE_TAU_MS : EASE_TAU_MS;
  const eased = shown + (target - shown) * (1 - Math.exp(-Math.min(dtMs, MAX_FRAME_MS) / tau));
  if (real >= 100 && 100 - eased < FINISH_SNAP) return 100;
  return Math.max(shown, eased);
}

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
      // Rounded so React skips frames where nothing visibly moved.
      setShown(Math.round(current.shown * 10) / 10);
      frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return shown;
}
