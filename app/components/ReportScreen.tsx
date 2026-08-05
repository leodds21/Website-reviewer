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
      <div className="mb-5 flex items-baseline justify-between">
        <Brand />
        <span className="font-mono text-xs text-[var(--color-neutral-700)]">{report.domain}</span>
      </div>

      <div className="mb-2 flex items-center gap-4">
        <ScoreRing score={report.score.overall} />
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

      <div className="mt-5 mb-5 flex flex-col gap-2.5">
        {CATEGORY_KEYS.map((key) => (
          <CategoryCard key={key} category={key} score={report.score[key].score} severity={report.score[key].severity} />
        ))}
      </div>

      <IssueList issues={report.issues} />

      <button
        type="button"
        onClick={onNextStep}
        className="mt-6 flex w-full items-center justify-center border border-[var(--color-accent)] bg-[var(--color-accent)] py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-600)]"
      >
        {t.nextStepButton}
      </button>
    </div>
  );
}
