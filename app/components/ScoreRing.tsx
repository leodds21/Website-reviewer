"use client";

import { useEffect, useState } from "react";

export function ScoreRing({ score, size = 82 }: { score: number; size?: number }) {
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
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={radius} fill="none" stroke="var(--color-neutral-200)" strokeWidth={7} />
      <circle
        cx={50}
        cy={50}
        r={radius}
        fill="none"
        stroke="var(--color-accent-700)"
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
