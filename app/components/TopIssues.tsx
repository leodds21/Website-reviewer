"use client";

import { SEVERITY_TEXT, SeverityMark } from "./SeverityMark";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { translateIssue } from "@/app/i18n/translations";
import { topIssues, type Issue } from "@/lib/issues";
import type { AggregatedScore } from "@/lib/score";

/** Brings a finding in the full list into view and moves focus to it. */
function showFinding(code: Issue["code"]) {
  const finding = document.getElementById(`finding-${code}`);
  if (!finding) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  finding.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  finding.focus({ preventScroll: true });
}

/**
 * "Corrija primeiro": the top of the one ranking the whole report uses
 * (lib/issues.ts), as a short summary pointing at the full findings
 * below, never a copy of them. Fewer than three real problems shows
 * fewer; only suggestions says so in a line; no findings at all shows
 * nothing, since the findings section already says the site is clean.
 */
export function TopIssues({ issues, score }: { issues: Issue[]; score: AggregatedScore }) {
  const { locale, t } = useLanguage();
  if (issues.length === 0) return null;
  const top = topIssues(issues, score);

  return (
    <section aria-labelledby="top-issues-heading" className="flex flex-col gap-3.5">
      <h2 id="top-issues-heading" className="text-2xl tracking-[-0.015em]">
        {t.topIssuesHeading}
      </h2>
      {top.length === 0 ? (
        <p className="text-[15px] text-[var(--color-muted)]">{t.topIssuesNone}</p>
      ) : (
        <ol className="rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)]">
          {top.map((issue, index) => {
            const { title } = translateIssue(locale, issue.code, issue.params);
            const severity = issue.severity === "critico" ? "critico" : "atencao";
            return (
              <li
                key={issue.code}
                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b border-[var(--color-line)] px-5 pt-4 pb-2 last:border-b-0 sm:px-6"
              >
                <span className="pt-0.5 font-mono text-sm text-[var(--color-label)]">{String(index + 1).padStart(2, "0")}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-subtle)] uppercase">{t.categories[issue.category]}</span>
                  <p className="text-[15px] leading-snug font-semibold text-[var(--color-text)]">{title}</p>
                  <div className="flex flex-wrap items-center gap-x-5">
                    <span className={`flex items-center gap-2 text-xs font-semibold ${SEVERITY_TEXT[severity]}`}>
                      <SeverityMark kind={severity} />
                      {t.impactLabel[severity]}
                    </span>
                    <button
                      type="button"
                      onClick={() => showFinding(issue.code)}
                      className="inline-flex min-h-11 items-center text-[13px] font-semibold text-[var(--color-link)] hover:underline"
                    >
                      {t.viewDetails}
                      {/* Three "Ver detalhes" in a row: the title tells them apart for a screen reader. */}
                      <span className="sr-only">: {title}</span>
                      <span aria-hidden="true">&nbsp;↓</span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
