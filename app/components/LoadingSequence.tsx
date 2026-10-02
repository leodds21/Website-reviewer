"use client";

import { useLanguage } from "@/app/i18n/LanguageContext";
import { useSmoothProgress } from "@/app/hooks/useSmoothProgress";

export type StepKey =
  | "https"
  | "securityHeaders"
  | "metaTags"
  | "altImages"
  | "sitemapRobots"
  | "pagespeed"
  | "brokenLinks"
  | "screenshots";

// Roughly how long each check takes relative to the others, so the bar
// advances with the real work instead of in equal sevenths: PageSpeed
// (a full Lighthouse run on Google's side) is most of the wait, the
// rest finish within a second or two of each other.
const STEP_WEIGHT: Record<StepKey, number> = {
  https: 7,
  securityHeaders: 3,
  metaTags: 8,
  altImages: 4,
  sitemapRobots: 8,
  brokenLinks: 10,
  // Two real-browser page loads, in parallel with everything else.
  screenshots: 15,
  pagespeed: 60,
};

const REAL_STEP_KEYS = Object.keys(STEP_WEIGHT) as StepKey[];
const TOTAL_WEIGHT = REAL_STEP_KEYS.reduce((sum, key) => sum + STEP_WEIGHT[key], 0);

type DisplayStepKey = "validating" | "performance" | "seo" | "accessibility" | "security" | "preview" | "finishing";
type StepStatus = "done" | "current" | "pending";

// Fixed display order, independent of the real (concurrent, any-order)
// settlement order the checks actually finish in — see settleInOrder
// in app/api/analyze/route.ts. "validating" and "finishing" are
// synthetic bookends with no check of their own: validating is true
// the moment this screen exists (the server already validated the URL
// before opening the stream), and finishing just means every real
// check has settled and the report is being assembled.
const DISPLAY_STEPS: { key: DisplayStepKey; requires: StepKey[] }[] = [
  { key: "validating", requires: [] },
  { key: "performance", requires: ["pagespeed"] },
  { key: "seo", requires: ["metaTags", "sitemapRobots", "brokenLinks"] },
  { key: "accessibility", requires: ["altImages"] },
  { key: "security", requires: ["https", "securityHeaders"] },
  { key: "preview", requires: ["screenshots"] },
  { key: "finishing", requires: [] },
];

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === "done") {
    // Keyed by status at the call site (see the `<li>` below), so
    // remounting here on the pending/current -> done transition is
    // what replays the pop-in animation — it's a CSS animation, not a
    // transition, so it only plays once on mount.
    return (
      <span
        className="step-done-marker h-[9px] w-[9px] shrink-0 bg-[var(--color-accent-900)]"
        aria-hidden="true"
      />
    );
  }
  if (status === "current") {
    return (
      <span className="relative flex h-[9px] w-[9px] shrink-0 items-center justify-center" aria-hidden="true">
        <span className="ping-ring" />
        <span className="ping-ring" style={{ animationDelay: "0.8s" }} />
        <span className="relative h-[9px] w-[9px] bg-[var(--color-accent-700)]" />
      </span>
    );
  }
  return <span className="h-[9px] w-[9px] shrink-0 border-[1.5px] border-[var(--color-neutral-200)]" aria-hidden="true" />;
}

export function LoadingSequence({ completedSteps }: { completedSteps: StepKey[] }) {
  const { t } = useLanguage();
  const completedSet = new Set(completedSteps);
  const allRealDone = REAL_STEP_KEYS.every((key) => completedSet.has(key));

  const items = DISPLAY_STEPS.map((step): { key: DisplayStepKey; status: StepStatus } => {
    if (step.key === "validating") return { key: step.key, status: "done" };
    if (step.key === "finishing") return { key: step.key, status: allRealDone ? "current" : "pending" };
    const done = step.requires.every((key) => completedSet.has(key));
    return { key: step.key, status: done ? "done" : "pending" };
  });

  // Exactly one pending step gets highlighted as "current" — a focal
  // point for the eye, not a claim about which check is literally
  // executing right now (checks run concurrently and can settle in
  // any order). Nothing here ever marks a step done before its real
  // result has actually arrived.
  const firstPendingIndex = items.findIndex((item) => item.status === "pending");
  if (firstPendingIndex !== -1) items[firstPendingIndex] = { ...items[firstPendingIndex], status: "current" };

  const realPercent =
    (REAL_STEP_KEYS.filter((key) => completedSet.has(key)).reduce((sum, key) => sum + STEP_WEIGHT[key], 0) /
      TOTAL_WEIGHT) *
    100;
  const progressPercent = useSmoothProgress(realPercent);

  return (
    <div role="status" aria-live="polite">
      <div className="mb-2 text-xs font-semibold tracking-[0.12em] text-[var(--color-accent-700)] uppercase">
        {t.loadingKicker}
      </div>
      <h1 className="mb-2 text-2xl tracking-tight">{t.loadingHeadline}</h1>
      <p className="mb-5 text-[13px] leading-relaxed text-[var(--color-text)]/80">{t.loadingSubtitle}</p>

      {/* Hidden from assistive tech: the value changes every frame, and
          the step list below is what announces real progress. */}
      <div aria-hidden="true">
        <div className="mb-1.5 flex items-baseline justify-end">
          <span className="font-mono text-[11px] tabular-nums text-[var(--color-neutral-700)]">
            {Math.floor(progressPercent)}%
          </span>
        </div>
        <div className="progress-track mb-6 h-[3px]">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }}>
            <span className="progress-shimmer" />
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          // Keyed by status, not just item.key: this remounts the row
          // (and its indicator) on every pending -> current -> done
          // transition, which is what replays the CSS animations —
          // a plain prop change wouldn't, since animation (unlike
          // transition) only plays once per mount.
          <li
            key={`${item.key}-${item.status}`}
            className="fade-in-up flex items-center gap-2.5"
            aria-current={item.status === "current" ? "step" : undefined}
          >
            <StepIndicator status={item.status} />
            <span
              className={
                item.status === "pending"
                  ? "text-[13px] text-[var(--color-neutral-700)]"
                  : item.status === "current"
                    ? "text-[13px] font-medium text-[var(--color-text)]"
                    : "text-[13px] text-[var(--color-text)]/80"
              }
            >
              {t.loadingSteps[item.key]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
