"use client";

import { Brand, Corners } from "./Chrome";
import { ScoreRing } from "./ScoreRing";
import { CategoryCard } from "./CategoryCard";
import { IssueList } from "./IssueList";
import { useLanguage } from "@/app/i18n/LanguageContext";
import type { CategoryKey } from "@/app/i18n/translations";
import type { AnalyzeReport } from "@/lib/report";
import type { IssueSeverity } from "@/lib/issues";
import type { TechPlatform } from "@/lib/checks/techDetect";

const CATEGORY_KEYS: CategoryKey[] = ["performance", "seo", "accessibility", "security"];

// Proper nouns — same spelling in every locale, so this stays outside
// the translation dictionary; only the sentence around it (t.platformDetected) is translated.
const PLATFORM_NAMES: Record<TechPlatform, string> = {
  wordpress: "WordPress",
  wix: "Wix",
  squarespace: "Squarespace",
  shopify: "Shopify",
};

export function ReportScreen({
  report,
  onNextStep,
  onManualAnalysis,
}: {
  report: AnalyzeReport;
  onNextStep: () => void;
  onManualAnalysis: () => void;
}) {
  const { t } = useLanguage();
  const measuredCategories = CATEGORY_KEYS.filter((key) => report.score[key].score !== null).length;
  const partialScore = measuredCategories < CATEGORY_KEYS.length;
  // A blocked site with nothing found has nothing to "fix": the useful
  // next step there is a manual look, not an empty recommendations page.
  const primaryIsManual = Boolean(report.blocked) && report.issues.length === 0;

  const counts: Record<IssueSeverity, number> = { critico: 0, atencao: 0, sugestao: 0 };
  for (const issue of report.issues) counts[issue.severity]++;
  const issueSummary = t.issueSummary(counts);
  const scoreLabel =
    report.score.overallSeverity === "ok"
      ? t.scoreLabelOk
      : report.score.overallSeverity === "critico"
        ? t.scoreLabelCritical
        : t.scoreLabelAttention;

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
        <div className="text-right">
          <span className="font-mono text-xs text-[var(--color-neutral-700)]">{report.domain}</span>
          {report.platform && (
            <div className="font-mono text-[10px] text-[var(--color-neutral-700)]">
              {t.platformDetected(PLATFORM_NAMES[report.platform])}
            </div>
          )}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-4">
        <ScoreRing score={report.score.overall} severity={report.score.overallSeverity} partial={partialScore} />
        <div>
          <div className="text-[38px] font-semibold leading-none tracking-tight">
            {report.score.overall}
            <span className="text-base font-normal text-[var(--color-neutral-700)]"> /100</span>
          </div>
          <span className="mt-1.5 inline-flex border border-[var(--color-accent)] px-2.5 py-0.5 text-[11px] text-[var(--color-accent-700)]">
            {scoreLabel}
          </span>
          {issueSummary.length > 0 && (
            <p className="mt-1.5 text-[11.5px] text-[var(--color-neutral-700)]">
              {issueSummary.map((part, index) => (
                <span key={part} className="whitespace-nowrap">
                  {index > 0 && " · "}
                  {part}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      {partialScore && (
        <p className="mb-2 max-w-sm text-[11.5px] leading-snug text-[var(--color-neutral-700)]">
          {t.coverageNote(measuredCategories)}
        </p>
      )}

      <details className="group mb-1">
        <summary className="-my-1 flex w-fit cursor-pointer list-none items-center gap-1 py-1.5 text-[11.5px] text-[var(--color-accent-700)] hover:underline focus-visible:underline [&::-webkit-details-marker]:hidden">
          {t.scoreExplanationToggle}
          <span className="inline-block transition-transform group-open:rotate-180" aria-hidden="true">
            ⌄
          </span>
        </summary>
        <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-[var(--color-text)]/70">{t.scoreExplanation}</p>
      </details>

      <div className="mt-5 mb-5 flex flex-col gap-2.5">
        {CATEGORY_KEYS.map((key) => (
          <CategoryCard key={key} category={key} result={report.score[key]} />
        ))}
      </div>

      {report.blocked && (
        // Neutral on purpose (accent, not a severity color): being blocked
        // isn't a finding about the site, just why this report is thinner.
        <div className="mb-5 border-l-2 border-[var(--color-accent-700)] py-0.5 pl-3">
          <p className="text-[12.5px] leading-relaxed text-[var(--color-text)]/80">{t.blockedNote}</p>
          {/* Inline link only when the big button below goes elsewhere. */}
          {!primaryIsManual && (
            <button
              type="button"
              onClick={onManualAnalysis}
              className="-mx-1 mt-1.5 px-1 py-0.5 text-[12.5px] font-medium text-[var(--color-accent-700)] hover:underline focus-visible:underline"
            >
              {t.manualAnalysisButton} <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      )}

      <IssueList issues={report.issues} />

      <button
        type="button"
        onClick={primaryIsManual ? onManualAnalysis : onNextStep}
        className="mt-6 flex w-full items-center justify-center border border-[var(--color-accent-700)] bg-[var(--color-accent-700)] py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:border-[var(--color-accent-800)] hover:bg-[var(--color-accent-800)] active:bg-[var(--color-accent-900)]"
      >
        {primaryIsManual
          ? `${t.manualAnalysisButton} →`
          : report.issues.length === 0
            ? t.nextStepButtonClean
            : t.nextStepButton}
      </button>
    </div>
  );
}
