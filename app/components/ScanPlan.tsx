"use client";

import { useLanguage } from "@/app/i18n/LanguageContext";
import { useSmoothProgress } from "@/app/hooks/useSmoothProgress";
import { SCAN_STEPS, type StepKey } from "@/lib/scanSteps";

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
  pagespeed: 60,
};
const TOTAL_WEIGHT = SCAN_STEPS.reduce((sum, key) => sum + STEP_WEIGHT[key], 0);

type StepStatus = "waiting" | "running" | "done";

function StatusMark({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="text-[var(--color-severity-ok)]">
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "running") {
    return <span aria-hidden="true" className="pulse-dot h-2 w-2 rounded-full bg-[var(--color-link)]" />;
  }
  return <span aria-hidden="true" className="h-2 w-2 rounded-full border border-[var(--color-line-strong)]" />;
}

function SmoothProgressBar({ realPercent }: { realPercent: number }) {
  const percent = useSmoothProgress(realPercent);
  return (
    <div aria-hidden="true" className="h-[3px] overflow-hidden rounded-b-lg bg-[var(--color-line)]">
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

/**
 * The seven real checks, listed before the scan starts (so the visitor
 * knows what will be looked at) and turned into live progress once it
 * runs: each row flips to "concluída" when its step event arrives.
 * Real completion only; nothing is marked done ahead of the server.
 */
export function ScanPlan({ running, completedSteps }: { running: boolean; completedSteps: StepKey[] }) {
  const { t } = useLanguage();
  const completed = new Set(completedSteps);
  const doneCount = SCAN_STEPS.filter((key) => completed.has(key)).length;
  const realPercent = (SCAN_STEPS.reduce((sum, key) => sum + (completed.has(key) ? STEP_WEIGHT[key] : 0), 0) / TOTAL_WEIGHT) * 100;

  return (
    <section aria-labelledby="scan-plan-heading" className="flex min-w-0 flex-col rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
        <h2 id="scan-plan-heading" className="font-mono text-xs font-medium tracking-[0.16em] text-[var(--color-label)] uppercase">
          {t.scanPlan.heading}
        </h2>
        {/* The one live region: announces "3 / 7 concluídas" as it
            changes, instead of every row's status word. */}
        <span role="status" className="font-mono text-xs text-[var(--color-subtle)]">
          {t.scanPlan.progress(doneCount, SCAN_STEPS.length)}
        </span>
      </div>

      <ol className="flex flex-1 flex-col py-1">
        {SCAN_STEPS.map((key, index) => {
          const status: StepStatus = completed.has(key) ? "done" : running ? "running" : "waiting";
          const step = t.scanPlan.steps[key];
          return (
            <li
              key={key}
              className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 border-b border-[var(--color-line)]/60 px-5 py-3 last:border-b-0 sm:grid-cols-[1.5rem_9rem_minmax(0,1fr)_auto]"
            >
              <span className="font-mono text-xs text-[var(--color-subtle)]">{String(index + 1).padStart(2, "0")}</span>
              <span className="font-mono text-sm text-[var(--color-text)]">{step.name}</span>
              <span className="col-start-2 row-start-2 text-[13px] text-[var(--color-subtle)] sm:col-start-3 sm:row-start-1">
                {step.description}
              </span>
              <span className="col-start-3 row-start-1 flex items-center justify-end gap-2 font-mono text-xs text-[var(--color-subtle)] sm:col-start-4">
                <StatusMark status={status} />
                {t.scanPlan.status[status]}
              </span>
            </li>
          );
        })}
      </ol>

      {running ? <SmoothProgressBar realPercent={realPercent} /> : <div aria-hidden="true" className="h-[3px] rounded-b-lg bg-[var(--color-line)]" />}
    </section>
  );
}
