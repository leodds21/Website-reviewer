"use client";

import { Brand, Corners } from "./Chrome";
import { ScoreRing } from "./ScoreRing";
import { CategoryCard } from "./CategoryCard";
import { IssueList } from "./IssueList";
import { useLanguage } from "@/app/i18n/LanguageContext";
import type { CategoryKey } from "@/app/i18n/translations";
import type { AnalyzeReport } from "@/lib/report";

const CATEGORY_KEYS: CategoryKey[] = ["performance", "seo", "accessibility", "security"];

export function ReportScreen({ report, onNextStep }: { report: AnalyzeReport; onNextStep: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="blueprint bg-white/60 p-5">
      <Corners />
      {/* The screen's real title. Visually the domain and the big score
          already say this, but neither is a heading, so without it a
          screen reader lands on a card with no name and the document
          jumps straight from nothing to an h2. */}
      <h1 className="sr-only">{t.reportHeading(report.domain)}</h1>
      <div className="mb-5 flex items-baseline justify-between">
        <Brand />
        <span className="font-mono text-xs text-[var(--color-neutral-700)]">{report.domain}</span>
      </div>

      <div className="mb-2 flex items-center gap-4">
        <ScoreRing score={report.score.overall} severity={report.score.overallSeverity} />
        <div>
          <div className="text-[38px] font-semibold leading-none tracking-tight">
            {report.score.overall}
            <span className="text-base font-normal text-[var(--color-neutral-700)]"> /100</span>
          </div>
          <span className="mt-1.5 inline-flex border border-[var(--color-accent)] px-2.5 py-0.5 text-[11px] text-[var(--color-accent-700)]">
            {report.score.overallSeverity === "ok" ? t.scoreLabelOk : t.scoreLabelAttention}
          </span>
        </div>
      </div>

      <details className="group mb-1">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11.5px] text-[var(--color-accent-700)] hover:underline focus-visible:underline [&::-webkit-details-marker]:hidden">
          {t.scoreExplanationToggle}
          <span className="inline-block transition-transform group-open:rotate-180" aria-hidden="true">
            ⌄
          </span>
        </summary>
        <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-[var(--color-text)]/70">{t.scoreExplanation}</p>
      </details>

      <div className="mt-5 mb-5 flex flex-col gap-2.5">
        {CATEGORY_KEYS.map((key) => (
          <CategoryCard key={key} category={key} score={report.score[key].score} severity={report.score[key].severity} />
        ))}
      </div>

      <IssueList issues={report.issues} />

      <button
        type="button"
        onClick={onNextStep}
        className="mt-6 flex w-full items-center justify-center border border-[var(--color-accent-700)] bg-[var(--color-accent-700)] py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:border-[var(--color-accent-800)] hover:bg-[var(--color-accent-800)] active:bg-[var(--color-accent-900)]"
      >
        {t.nextStepButton}
      </button>
    </div>
  );
}
