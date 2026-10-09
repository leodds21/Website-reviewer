"use client";

import { useEffect, useRef } from "react";
import { AppHeader, Brand, PageContainer, buttonClass } from "./Chrome";
import { Findings } from "./Findings";
import { Passes } from "./Passes";
import { TopIssues } from "./TopIssues";
import { ScoreSummary } from "./ScoreSummary";
import { useLanguage } from "@/app/i18n/LanguageContext";
import type { AnalyzeReport } from "@/lib/report";
import type { TechPlatform } from "@/lib/checks/techDetect";
import { SITE_URL } from "@/lib/siteUrl";

// Proper nouns, the same in every locale.
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
  onNewAnalysis,
}: {
  report: AnalyzeReport;
  onNextStep: () => void;
  onManualAnalysis: () => void;
  onNewAnalysis: () => void;
}) {
  const { locale, t } = useLanguage();
  // Blocked with nothing found: the next step is a manual review.
  const primaryIsManual = Boolean(report.blocked) && report.issues.length === 0;
  const primaryAction = primaryIsManual ? onManualAnalysis : onNextStep;
  const primaryLabel = primaryIsManual
    ? `${t.manualAnalysisButton} →`
    : report.issues.length === 0
      ? t.nextStepButtonClean
      : t.nextStepButton;

  const rootRef = useRef<HTMLDivElement>(null);

  // Opens every collapsed section for printing, Ctrl+P included.
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    function openAll() {
      opened = [...(rootRef.current?.querySelectorAll("details:not([open])") ?? [])] as HTMLDetailsElement[];
      for (const details of opened) details.open = true;
    }
    function restore() {
      for (const details of opened) details.open = false;
      opened = [];
    }
    window.addEventListener("beforeprint", openAll);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", openAll);
      window.removeEventListener("afterprint", restore);
    };
  }, []);

  const checkedAt = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(report.checkedAt),
  );

  return (
    <div ref={rootRef} className="flex min-h-dvh flex-col">
      <AppHeader>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
          <Brand />
          <span className="font-mono text-[13px] break-all text-[var(--color-body)]">{report.domain}</span>
          <span className="font-mono text-xs text-[var(--color-subtle)]">
            {checkedAt}
            {report.platform && ` · ${t.platformDetected(PLATFORM_NAMES[report.platform])}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5 print:hidden">
          <button type="button" onClick={onNewAnalysis} className={buttonClass.secondary}>
            {t.newAnalysis}
          </button>
          <button type="button" onClick={primaryAction} className={buttonClass.primary}>
            {primaryLabel}
          </button>
        </div>
      </AppHeader>

      {/* For assistive tech: the domain above isn't a heading. */}
      <h1 className="sr-only">{t.reportHeading(report.domain)}</h1>

      <PageContainer className="grid flex-1 items-start gap-8 py-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12 lg:py-10">
        <ScoreSummary report={report} />

        <div className="flex min-w-0 flex-col gap-10">
          {report.blocked && (
            // Neutral color: being blocked isn't a finding about the site.
            <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4 sm:px-6">
              <p className="text-sm leading-relaxed text-[var(--color-muted)]">{t.blockedNote}</p>
              {!primaryIsManual && (
                <button
                  type="button"
                  onClick={onManualAnalysis}
                  className="inline-flex min-h-11 w-fit items-center text-sm font-semibold text-[var(--color-link)] hover:underline print:hidden"
                >
                  {t.manualAnalysisButton} <span aria-hidden="true">&nbsp;→</span>
                </button>
              )}
            </div>
          )}

          <TopIssues issues={report.issues} score={report.score} />
          <Findings issues={report.issues} score={report.score} />
          <Passes passes={report.passed ?? []} open={report.issues.length === 0} />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-line)] pt-8 print:hidden">
            <p className="font-heading text-2xl font-medium tracking-[-0.02em] text-[var(--color-text)]">{t.reportCta}</p>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={() => window.print()} className={`${buttonClass.secondary} min-h-12 px-6 text-base`}>
                {t.printButton}
              </button>
              <button type="button" onClick={primaryAction} className={`${buttonClass.primary} min-h-12 px-7 text-base`}>
                {primaryLabel}
              </button>
            </div>
          </div>

          <p className="hidden border-t border-[var(--color-line)] pt-4 font-mono text-xs text-[var(--color-subtle)] print:block">
            {t.printFooter(new URL(SITE_URL).host)}
          </p>
        </div>
      </PageContainer>
    </div>
  );
}
