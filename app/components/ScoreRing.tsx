"use client";

import { useEffect, useState } from "react";
import type { Severity } from "@/lib/score";

// Same severity → color mapping CategoryCard's bars and IssueList's
// badges use — the ring, the bars, and the findings are all reporting
// the same severity system, so they read as one visual language
// instead of three different ones each picking their own color.
const RING_COLOR: Record<Severity, string> = {
  critico: "var(--color-severity-critico)",
  atencao: "var(--color-severity-atencao)",
  ok: "var(--color-severity-ok)",
  indisponivel: "var(--color-neutral-200)",
};

export function ScoreRing({
  score,
  severity,
  partial = false,
  size = 82,
}: {
  score: number;
  severity: Severity;
  // A dashed track when the score covers only some categories, so the
  // ring itself reads as incomplete, not just the caption next to it.
  partial?: boolean;
  size?: number;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  // Starts empty and animates to the real value on mount — a static
  // dashoffset set on first paint never transitions, since CSS
  // transitions only fire on a value change after mount.
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  const offset = circumference - (filled / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle
        cx={50}
        cy={50}
        r={radius}
        fill="none"
        stroke="var(--color-neutral-200)"
        strokeWidth={7}
        strokeDasharray={partial ? "4 4" : undefined}
      />
      <circle
        cx={50}
        cy={50}
        r={radius}
        fill="none"
        stroke={RING_COLOR[severity]}
        strokeWidth={7}
        strokeLinecap="square"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
        className="transition-[stroke-dashoffset] duration-1000 ease-out"
      />
    </svg>
  );
}
