"use client";

import { useLanguage } from "@/app/i18n/LanguageContext";

export type StepKey = "https" | "securityHeaders" | "metaTags" | "altImages" | "sitemapRobots" | "pagespeed";

const REAL_STEP_KEYS: StepKey[] = ["https", "securityHeaders", "metaTags", "altImages", "sitemapRobots", "pagespeed"];

type DisplayStepKey = "validating" | "performance" | "seo" | "accessibility" | "security" | "finishing";
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
  { key: "seo", requires: ["metaTags", "sitemapRobots"] },
  { key: "accessibility", requires: ["altImages"] },
  { key: "security", requires: ["https", "securityHeaders"] },
  { key: "finishing", requires: [] },
];

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === "done") {
    return <span className="h-[9px] w-[9px] shrink-0 bg-[var(--color-accent-900)]" aria-hidden="true" />;
  }
  if (status === "current") {
    return <span className="h-[9px] w-[9px] shrink-0 animate-pulse bg-[var(--color-accent-700)]" aria-hidden="true" />;
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

  const progressPercent = Math.round((completedSteps.length / REAL_STEP_KEYS.length) * 100);

  return (
    <div role="status" aria-live="polite">
      <div className="mb-2 text-xs font-semibold tracking-[0.12em] text-[var(--color-accent-700)] uppercase">
        {t.loadingKicker}
      </div>
      <h2 className="mb-2 text-2xl tracking-tight">{t.loadingHeadline}</h2>
      <p className="mb-5 text-[13px] leading-relaxed text-[var(--color-text)]/80">{t.loadingSubtitle}</p>

      <div
        className="progress-track mb-6 h-[3px]"
        style={{ "--progress": `${progressPercent}%` } as React.CSSProperties}
      />

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2.5" aria-current={item.status === "current" ? "step" : undefined}>
            <StepIndicator status={item.status} />
            <span
              className={
                item.status === "pending"
                  ? "text-[13px] text-[var(--color-neutral-600)]"
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
