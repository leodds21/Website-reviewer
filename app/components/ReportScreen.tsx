"use client";

import { AppHeader, Brand, PageContainer } from "./Chrome";
import { Findings } from "./Findings";
import { ScoreSummary } from "./ScoreSummary";
import { useLanguage } from "@/app/i18n/LanguageContext";
import type { AnalyzeReport } from "@/lib/report";
import type { TechPlatform } from "@/lib/checks/techDetect";

// Proper nouns — same spelling in every locale, so this stays outside
// the translation dictionary; only the sentence around it (t.platformDetected) is translated.
const PLATFORM_NAMES: Record<TechPlatform, string> = {
  wordpress: "WordPress",
  wix: "Wix",
  squarespace: "Squarespace",
  shopify: "Shopify",
};

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-accent)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--color-line-strong)] px-5 text-sm font-semibold text-[var(--color-body)] transition-colors hover:border-[var(--color-subtle)]";

export function ReportScreen({
  report,
  onNextStep,
  onManualAnalysis,
  onNewAnalysis,
}: {
  report: AnalyzeReport;
  onNextStep: () => void;
  onManualAnalysis: () => void;
  onNewAnalysis: () => void;
}) {
  const { locale, t } = useLanguage();
  // A blocked site with nothing found has nothing to "fix": the useful
  // next step there is a manual look, not an empty recommendations page.
  const primaryIsManual = Boolean(report.blocked) && report.issues.length === 0;
  const primaryAction = primaryIsManual ? onManualAnalysis : onNextStep;
  const primaryLabel = primaryIsManual
    ? `${t.manualAnalysisButton} →`
    : report.issues.length === 0
      ? t.nextStepButtonClean
      : t.nextStepButton;

  const checkedAt = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(report.checkedAt),
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
          <Brand />
          <span className="font-mono text-[13px] break-all text-[var(--color-body)]">{report.domain}</span>
          <span className="font-mono text-xs text-[var(--color-subtle)]">
            {checkedAt}
            {report.platform && ` · ${t.platformDetected(PLATFORM_NAMES[report.platform])}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={onNewAnalysis} className={secondaryButton}>
            {t.newAnalysis}
          </button>
          <button type="button" onClick={primaryAction} className={primaryButton}>
            {primaryLabel}
          </button>
        </div>
      </AppHeader>

      {/* The screen's real title, for assistive tech: the domain above
          isn't a heading, and the findings start at h2. */}
      <h1 className="sr-only">{t.reportHeading(report.domain)}</h1>

      <PageContainer className="grid flex-1 items-start gap-8 py-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12 lg:py-10">
        <ScoreSummary report={report} />

        <div className="flex min-w-0 flex-col gap-10">
          {report.blocked && (
            // Neutral on purpose (no severity color): being blocked isn't
            // a finding about the site, just why this report is thinner.
            <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4 sm:px-6">
              <p className="text-sm leading-relaxed text-[var(--color-muted)]">{t.blockedNote}</p>
              {!primaryIsManual && (
                <button
                  type="button"
                  onClick={onManualAnalysis}
                  className="inline-flex min-h-11 w-fit items-center text-sm font-semibold text-[var(--color-link)] hover:underline"
                >
                  {t.manualAnalysisButton} <span aria-hidden="true">&nbsp;→</span>
                </button>
              )}
            </div>
          )}

          <Findings issues={report.issues} />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-line)] pt-8">
            <p className="font-heading text-2xl font-medium tracking-[-0.02em] text-[var(--color-text)]">{t.reportCta}</p>
            <button type="button" onClick={primaryAction} className={`${primaryButton} min-h-12 px-7 text-base`}>
              {primaryLabel}
            </button>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
