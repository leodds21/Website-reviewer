"use client";

import { useId } from "react";

// The LD symbol from lsdias.dev. Its own gradient id per instance: a
// reference into a hidden copy (the print cover on screen) paints nothing.
export function LogoMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  const gradient = useId();
  return (
    <svg aria-hidden="true" viewBox="16 2 210 193" height={size} width={Math.round((size * 210) / 193)} className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id={gradient} x1="60" y1="30" x2="180" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6BCFFA" />
          <stop offset=".46" stopColor="#2E8BFF" />
          <stop offset="1" stopColor="#0B4FF5" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradient})`}>
        <path d="M18 4H41V132H124L111 155H18Z" />
        <path d="M77 25H140A84 84 0 0 1 140 193H109L122 171H140A62 62 0 0 0 140 47H77Z" />
      </g>
    </svg>
  );
}
