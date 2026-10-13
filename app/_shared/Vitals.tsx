"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { vitalsRoute, vitalsUrl } from "@/lib/vitalsUrl";

// Real visitors' Core Web Vitals (LCP, INP, CLS, FCP, TTFB), via Vercel Speed Insights.
export function Vitals() {
  return (
    <SpeedInsights
      beforeSend={(event) => ({ ...event, url: vitalsUrl(event.url), ...(event.route && { route: vitalsRoute(event.route) }) })}
    />
  );
}
