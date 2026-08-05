"use client";

import { useLanguage } from "@/app/i18n/LanguageContext";
import type { CategoryKey } from "@/app/i18n/translations";

export type StepKey = "https" | "metaTags" | "altImages" | "sitemapRobots" | "pagespeed";

const CATEGORY_GROUPS: { key: CategoryKey; steps: StepKey[] }[] = [
  { key: "security", steps: ["https"] },
  { key: "seo", steps: ["metaTags", "sitemapRobots"] },
  { key: "accessibility", steps: ["altImages"] },
  { key: "performance", steps: ["pagespeed"] },
];

export function LoadingSequence({ completedSteps }: { completedSteps: StepKey[] }) {
  const { t } = useLanguage();
  const completedSet = new Set(completedSteps);
  const currentGroup = completedSteps.length > 0
    ? CATEGORY_GROUPS.find((group) => group.steps.includes(completedSteps[completedSteps.length - 1]))
    : null;

  return (
    <div role="status" aria-live="polite">
      <div className="mb-6 flex items-center gap-2" aria-hidden="true">
        {CATEGORY_GROUPS.map((group, index) => {
          const done = group.steps.every((step) => completedSet.has(step));
          const active = !done && group.key === currentGroup?.key;
          return (
            <div key={group.key} className="flex items-center gap-2">
              <span
                className={`h-[9px] w-[9px] ${
                  done
                    ? "bg-[var(--color-accent-900)]"
                    : active
                      ? "animate-pulse bg-[var(--color-accent)]"
                      : "border-[1.5px] border-[var(--color-neutral-200)]"
                }`}
              />
              {index < CATEGORY_GROUPS.length - 1 && (
                <span
                  className={`h-px w-8 ${done ? "bg-[var(--color-accent-900)]" : "bg-[var(--color-neutral-200)]"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <h2 className="mb-2 text-2xl tracking-tight">
        {currentGroup ? t.verifying(t.categories[currentGroup.key].toLowerCase()) : t.startingAnalysis}
      </h2>
      <p className="mb-4 text-[13px] text-[var(--color-text)]/70">{t.loadingSubtitle}</p>

      <div className="progress-track h-[3px]" />

      <ul className="mt-4 flex flex-col gap-2">
        {CATEGORY_GROUPS.filter((group) => group.steps.every((step) => completedSet.has(step))).map((group) => (
          <li key={group.key} className="fade-in-up text-[13px] text-[var(--color-text)]/80">
            {t.checkDone(t.categories[group.key])}
          </li>
        ))}
      </ul>
    </div>
  );
}
