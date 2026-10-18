"use client";

import { LogoMark } from "./LogoMark";
import { ScoreMeter, overallLabel, overallShown } from "./ScoreSummary";
import { SEVERITY_TEXT, SeverityMark } from "./SeverityMark";
import { useLanguage } from "@/app/i18n/LanguageContext";
import type { CategoryKey } from "@/app/i18n/types";
import type { AnalyzeReport } from "@/lib/report";
import { SITE_URL } from "@/lib/siteUrl";

const CATEGORY_KEYS: CategoryKey[] = ["performance", "seo", "accessibility", "security"];

/** Paper only: the first page of the saved PDF, dark like the site. */
export function ReportPrintCover({ report, checkedAt, unfinished }: { report: AnalyzeReport; checkedAt: string | null; unfinished: boolean }) {
  const { locale, t } = useLanguage();
  const { severity, noScore } = overallShown(report, unfinished);
  const reportUrl = report.id ? `${new URL(SITE_URL).host}/${locale}/report/${report.id}` : null;

  return (
    <section aria-hidden="true" className="report-cover hidden flex-col justify-between px-[18mm] pt-[20mm] pb-[16mm] print:flex">
      <div aria-hidden="true" className="report-grid" />
      <span aria-hidden="true" className="brand-rule absolute inset-x-0 top-0 h-[4px]" />

      <div className="relative flex items-center gap-3 font-heading text-[22px] font-semibold text-[var(--color-text)]">
        <LogoMark size={30} />
        <span>
          lsdias<span className="text-[var(--color-link)]">.dev</span>{" "}
          <span className="font-mono text-sm font-normal text-[var(--color-subtle)]">/ scanner</span>
        </span>
      </div>

      <div className="relative flex flex-col gap-5">
        <p className="font-mono text-xs tracking-[0.22em] text-[var(--color-label)] uppercase">{t.reportEyebrow}</p>
        <p className="font-heading text-[56px] leading-[0.95] font-semibold tracking-[-0.04em] break-all text-[var(--color-text)]">{report.domain}</p>
        {checkedAt && (
          <p className="font-mono text-sm text-[var(--color-muted)]">
            {t.coverAnalyzedOn} {checkedAt}
          </p>
        )}
      </div>

      <div className="relative flex flex-col gap-8">
        <div className="flex max-w-[110mm] flex-col gap-3">
          <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-subtle)] uppercase">{t.overallScore}</span>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-[120px] leading-[0.85] font-medium tracking-[-0.05em] text-[var(--color-text)]">
              {noScore ? "--" : report.score.overall}
            </span>
            <span className="font-mono text-lg text-[var(--color-subtle)]">/100</span>
          </div>
          {!noScore && <ScoreMeter score={report.score.overall} severity={severity} />}
          <p className={`text-lg font-semibold ${SEVERITY_TEXT[severity]}`}>{overallLabel(t, severity)}</p>
        </div>

        <ul className="grid grid-cols-4 border-t border-[var(--color-line-strong)]">
          {CATEGORY_KEYS.map((key) => {
            const category = report.score[key];
            const kind = unfinished && category.severity === "pendente" ? "indisponivel" : category.severity;
            return (
              <li key={key} className="flex flex-col gap-2 border-r border-[var(--color-line)] pt-4 pr-4 pl-4 first:pl-0 last:border-r-0">
                <span className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                  <SeverityMark kind={kind} />
                  {t.categories[key]}
                </span>
                <span className={`font-heading text-4xl font-medium ${SEVERITY_TEXT[kind]}`}>{category.score ?? "–"}</span>
              </li>
            );
          })}
        </ul>

        <div className="flex items-end justify-between gap-6 border-t border-[var(--color-line)] pt-5 font-mono text-xs text-[var(--color-subtle)]">
          {reportUrl ? (
            <span>
              {t.coverReportLink}: <span className="text-[var(--color-link)]">{reportUrl}</span>
            </span>
          ) : (
            <span />
          )}
          <span>www.lsdias.dev</span>
        </div>
      </div>
    </section>
  );
}
