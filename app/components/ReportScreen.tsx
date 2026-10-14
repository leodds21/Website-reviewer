"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { AppHeader, Brand, PageContainer, buttonClass } from "./Chrome";
import { Findings } from "./Findings";
import { LogoMark } from "./LogoMark";
import { Passes } from "./Passes";
import { ReportPrintCover } from "./ReportPrintCover";
import { TopIssues } from "./TopIssues";
import { ScoreSummary } from "./ScoreSummary";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { INTL_LOCALE } from "@/app/i18n/locale";
import type { AnalyzeReport } from "@/lib/report";
import type { TechPlatform } from "@/lib/checks/techDetect";
import { SITE_URL } from "@/lib/siteUrl";

const noSubscription = () => () => {};

// Proper nouns, the same in every locale.
const PLATFORM_NAMES: Record<TechPlatform, string> = {
  wordpress: "WordPress",
  wix: "Wix",
  squarespace: "Squarespace",
  shopify: "Shopify",
};

// A numbered label above each part of the report, like the site's section eyebrows.
function ReportBlock({ index, label, children }: { index: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="print-keep-with-next flex items-center gap-3 font-mono text-[11px] tracking-[0.2em] text-[var(--color-label)] uppercase">
        <span>{String(index).padStart(2, "0")}</span>
        <span aria-hidden="true" className="h-px w-8 bg-[var(--color-line-strong)]" />
        <span>{label}</span>
      </p>
      {children}
    </div>
  );
}

export function ReportScreen({
  report,
  unfinished = false,
  onNextStep,
  onManualAnalysis,
  onNewAnalysis,
}: {
  report: AnalyzeReport;
  unfinished?: boolean;
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

  // In the visitor's time zone, so only in the browser: the server's (UTC)
  // would differ and make React throw away the server-rendered report.
  const checkedAt = useSyncExternalStore(
    noSubscription,
    () => new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "short", timeStyle: "short" }).format(new Date(report.checkedAt)),
    () => null,
  );
  const host = new URL(SITE_URL).host;
  const reportPath = report.id ? `${host}/${locale}/report/${report.id}` : null;

  let block = 0;

  return (
    <div ref={rootRef} className="flex min-h-dvh flex-col">
      <ReportPrintCover report={report} checkedAt={checkedAt} unfinished={unfinished} />

      <AppHeader className="print:hidden">
        <Brand />
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={onNewAnalysis} className={buttonClass.secondary}>
            {t.newAnalysis}
          </button>
          <button type="button" onClick={primaryAction} className={buttonClass.primary}>
            {primaryLabel}
          </button>
        </div>
      </AppHeader>

      <div className="relative overflow-hidden border-b border-[var(--color-line)] print:hidden">
        <div aria-hidden="true" className="report-grid" />
        <PageContainer className="relative flex flex-col gap-4 pt-12 pb-10 sm:pt-16 sm:pb-14">
          <p className="font-mono text-[11px] tracking-[0.22em] text-[var(--color-label)] uppercase">
            {t.reportEyebrow}
            {checkedAt && <span className="text-[var(--color-subtle)]"> · {checkedAt}</span>}
          </p>
          <h1 className="max-w-[18ch] font-heading text-[40px] leading-[0.98] font-semibold tracking-[-0.04em] break-all sm:max-w-none sm:text-6xl lg:text-7xl">
            <span className="sr-only">{t.reportHeading(report.domain)}</span>
            <span aria-hidden="true">{report.domain}</span>
          </h1>
          {report.platform && (
            <p className="w-fit rounded-full border border-[var(--color-line-strong)] px-3 py-1 font-mono text-xs text-[var(--color-muted)]">
              {t.platformDetected(PLATFORM_NAMES[report.platform])}
            </p>
          )}
        </PageContainer>
      </div>

      <PageContainer className="print-inset grid flex-1 items-start gap-10 py-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-14 lg:py-14 print:py-0">
        <ScoreSummary report={report} unfinished={unfinished} />

        <div className="flex min-w-0 flex-col gap-14">
          {unfinished && report.inProgress && (
            <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4 text-sm leading-relaxed text-[var(--color-muted)] sm:px-6">
              {t.googleUnfinished}
            </p>
          )}
          {report.blocked && (
            // Neutral color: being blocked isn't a finding about the site.
            <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4 sm:px-6">
              <p className="text-sm leading-relaxed text-[var(--color-muted)]">{t.blockedNote}</p>
              {!primaryIsManual && (
                <button
                  type="button"
                  onClick={onManualAnalysis}
                  className="-my-1 inline-flex min-h-11 w-fit items-center text-sm font-semibold text-[var(--color-link)] hover:underline print:hidden"
                >
                  {t.manualAnalysisButton} <span aria-hidden="true">&nbsp;→</span>
                </button>
              )}
            </div>
          )}

          {report.issues.length > 0 && (
            <ReportBlock index={++block} label={t.reportSections.priority}>
              <TopIssues issues={report.issues} score={report.score} provisional={report.inProgress && !unfinished} />
            </ReportBlock>
          )}
          <ReportBlock index={++block} label={t.reportSections.findings}>
            <Findings issues={report.issues} score={report.score} />
          </ReportBlock>
          {report.passed.length > 0 && (
            <ReportBlock index={++block} label={t.reportSections.passes}>
              <Passes passes={report.passed} open={report.issues.length === 0} />
            </ReportBlock>
          )}

          <section className="relative mt-4 flex flex-col gap-6 overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface)] p-6 sm:p-10 print:hidden">
            <div aria-hidden="true" className="report-grid" />
            <div className="relative flex flex-col gap-4">
              <LogoMark size={32} />
              <h2 className="max-w-[22ch] text-3xl leading-[1.08] tracking-[-0.025em] sm:text-4xl">{t.reportCta}</h2>
              <p className="max-w-[58ch] text-[15px] leading-relaxed text-[var(--color-muted)]">{t.reportCtaBody}</p>
            </div>
            <div className="relative flex flex-wrap gap-2.5">
              <button type="button" onClick={primaryAction} className={`${buttonClass.primary} min-h-12 px-7 text-base`}>
                {primaryLabel}
              </button>
              <button type="button" onClick={() => window.print()} className={`${buttonClass.secondary} min-h-12 px-6 text-base`}>
                {t.printButton}
              </button>
            </div>
          </section>
        </div>
      </PageContainer>

      <footer className="mt-10 border-t border-[var(--color-line)] print:mt-8">
        <PageContainer className="print-inset flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-6 font-mono text-xs text-[var(--color-subtle)]">
          <span className="flex items-center gap-2.5">
            <LogoMark size={14} />
            {t.printFooter(host)}
          </span>
          {reportPath && <span className="hidden text-[var(--color-link)] print:inline">{reportPath}</span>}
          {checkedAt && <span className="print:hidden">{checkedAt}</span>}
        </PageContainer>
      </footer>
    </div>
  );
}
