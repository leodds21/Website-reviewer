"use client";

import { SEVERITY_TEXT, SeverityMark } from "./SeverityMark";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { translateIssue } from "@/app/i18n/translate";
import { topIssues, type Issue } from "@/lib/issues";
import type { AggregatedScore } from "@/lib/score";

function showFinding(code: Issue["code"]) {
  const finding = document.getElementById(`finding-${code}`);
  if (!finding) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  finding.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  finding.focus({ preventScroll: true });
}

// A summary pointing at the findings below, not a copy of them.
export function TopIssues({ issues, score, provisional = false }: { issues: Issue[]; score: AggregatedScore; provisional?: boolean }) {
  const { t } = useLanguage();
  if (issues.length === 0) return null;
  const top = topIssues(issues, score);

  return (
    <section aria-labelledby="top-issues-heading" className="flex flex-col gap-4">
      <h2 id="top-issues-heading" className="text-[28px] tracking-[-0.02em]">
        {t.topIssuesHeading}
      </h2>
      {provisional && <p className="-mt-1.5 text-[13px] text-[var(--color-subtle)]">{t.topIssuesProvisional}</p>}
      {top.length === 0 ? (
        <p className="text-[15px] text-[var(--color-muted)]">{t.topIssuesNone}</p>
      ) : (
        // The brand rail marks this as the part to read first.
        <ol className="relative overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface)]">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-[linear-gradient(180deg,#6bcffa,#2e8bff_46%,#0b4ff5)]" />
          {top.map((issue, index) => {
            const { title } = translateIssue(t, issue.code, issue.params);
            const severity = issue.severity === "critico" ? "critico" : "atencao";
            return (
              <li
                key={issue.code}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-b border-[var(--color-line)] px-5 py-5 last:border-b-0 sm:grid-cols-[3.25rem_minmax(0,1fr)] sm:px-7 sm:py-6"
              >
                <span className="font-heading text-[28px] leading-none font-medium tracking-[-0.03em] text-[var(--color-label)] tabular-nums sm:text-[34px]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-subtle)] uppercase">{t.categories[issue.category]}</span>
                  <p className="text-base leading-snug font-semibold text-[var(--color-text)] sm:text-[17px]">{title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-5">
                    <span className={`flex items-center gap-2 text-xs font-semibold ${SEVERITY_TEXT[severity]}`}>
                      <SeverityMark kind={severity} />
                      {t.impactLabel[severity]}
                    </span>
                    <button
                      type="button"
                      onClick={() => showFinding(issue.code)}
                      className="-my-2.5 inline-flex min-h-11 items-center text-[13px] font-semibold text-[var(--color-link)] hover:underline print:hidden"
                    >
                      {t.viewDetails}
                      {/* Tells the three "Ver detalhes" apart for screen readers. */}
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
