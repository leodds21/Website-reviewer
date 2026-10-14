"use client";

import { ToggleSummary } from "./Chrome";
import { SeverityMark } from "./SeverityMark";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { translateIssue, translateRecommendation } from "@/app/i18n/translate";
import { rankIssues, type Issue, type IssueSeverity } from "@/lib/issues";
import type { AggregatedScore } from "@/lib/score";

const MAX_AFFECTED_SHOWN = 10;

const GROUP_ORDER: IssueSeverity[] = ["critico", "atencao", "sugestao"];

function useIssueText(issue: Issue) {
  const { t } = useLanguage();
  return {
    ...translateIssue(t, issue.code, issue.params),
    recommendation: translateRecommendation(t, issue.code),
  };
}

// Plain text, never links: they come from the analyzed site.
function AffectedItems({ issue, compact = false }: { issue: Issue; compact?: boolean }) {
  const { t } = useLanguage();
  const affected = issue.affected ?? [];
  const heading = t.affectedHeading[issue.code];
  if (affected.length === 0 || !heading) return null;
  const hidden = affected.length - MAX_AFFECTED_SHOWN;

  return (
    <div className="flex flex-col gap-2">
      {!compact && <p className="text-xs font-semibold text-[var(--color-subtle)]">{heading(affected.length)}</p>}
      <ul aria-label={compact ? heading(affected.length) : undefined} className="flex flex-wrap gap-2">
        {affected.slice(0, MAX_AFFECTED_SHOWN).map((item, index) => (
          <li
            key={`${index}-${item}`}
            className={`max-w-full rounded-md border px-2.5 py-1 font-mono text-xs break-all ${
              item ? "border-[var(--color-line-strong)] text-[var(--color-body)]" : "border-dashed border-[var(--color-line-strong)] text-[var(--color-subtle)]"
            }`}
          >
            {item || t.imageWithoutSource}
          </li>
        ))}
      </ul>
      {hidden > 0 && <p className="text-xs text-[var(--color-subtle)]">{t.moreAffected(hidden)}</p>}
    </div>
  );
}

function HowToFix({ issue, recommendation }: { issue: Issue; recommendation: string }) {
  const { t } = useLanguage();
  return (
    <details>
      <ToggleSummary className="-mb-2 inline-flex min-h-11 text-[13px] font-semibold">{t.howToFix}</ToggleSummary>
      <div className="flex flex-col gap-3 pt-3">
        <p className="text-sm leading-relaxed text-[var(--color-body)]">
          {/* The toggle doesn't print, so the label goes with the text. */}
          <strong className="hidden font-semibold text-[var(--color-text)] print:inline">{t.howToFix}: </strong>
          {recommendation}
        </p>
        <AffectedItems issue={issue} />
      </div>
    </details>
  );
}

function CriticalFinding({ issue }: { issue: Issue }) {
  const { t } = useLanguage();
  const { title, description, recommendation } = useIssueText(issue);
  return (
    <li
      id={`finding-${issue.code}`}
      tabIndex={-1}
      className="flex scroll-mt-6 flex-col gap-3.5 rounded-xl border border-[var(--color-severity-critico)]/25 bg-[var(--color-severity-critico)]/[0.04] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-xl tracking-[-0.01em]">{title}</h3>
        <span className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-subtle)] uppercase">{t.categories[issue.category]}</span>
      </div>
      <p className="text-[15px] leading-relaxed text-[var(--color-muted)]">{description}</p>
      <AffectedItems issue={issue} compact />
      {recommendation && (
        <p className="border-t border-[var(--color-line)] pt-3 text-[15px] leading-relaxed text-[var(--color-body)]">
          <strong className="font-semibold text-[var(--color-text)]">{t.howToFix}:</strong> {recommendation}
        </p>
      )}
    </li>
  );
}

function FindingRow({ issue }: { issue: Issue }) {
  const { t } = useLanguage();
  const { title, description, recommendation } = useIssueText(issue);
  return (
    <li
      id={`finding-${issue.code}`}
      tabIndex={-1}
      className="flex scroll-mt-6 flex-col gap-1.5 border-b border-[var(--color-line)] px-5 py-5 last:border-b-0 sm:px-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-subtle)] uppercase">{t.categories[issue.category]}</span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">{description}</p>
      {recommendation && <HowToFix issue={issue} recommendation={recommendation} />}
    </li>
  );
}

function GroupHeading({ id, severity, count }: { id: string; severity: IssueSeverity; count: number }) {
  const { t } = useLanguage();
  const counts: Record<IssueSeverity, number> = { critico: 0, atencao: 0, sugestao: 0 };
  counts[severity] = count;
  return (
    <div className="print-keep-with-next flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 id={id} className="text-[28px] tracking-[-0.02em]">
        {t.findingGroups[severity]}
      </h2>
      <span className="flex items-center gap-2 font-mono text-xs text-[var(--color-subtle)]">
        <SeverityMark kind={severity} />
        {t.issueSummary(counts)[0]}
        {severity === "sugestao" && ` · ${t.optionalNote}`}
      </span>
    </div>
  );
}

// Same order as rankIssues within each group, matching "Corrija primeiro".
export function Findings({ issues, score }: { issues: Issue[]; score: AggregatedScore }) {
  const { t } = useLanguage();

  if (issues.length === 0) {
    return <p className="rounded-lg border border-[var(--color-line)] p-6 text-[15px] text-[var(--color-muted)]">{t.noIssues}</p>;
  }

  const ordered = rankIssues(issues, score);
  const groups = GROUP_ORDER.map((severity) => ({ severity, items: ordered.filter((issue) => issue.severity === severity) })).filter(
    (group) => group.items.length > 0,
  );

  return (
    <div className="flex flex-col gap-12">
      {groups.map(({ severity, items }) => {
        const headingId = `findings-${severity}`;
        if (severity === "critico") {
          return (
            <section key={severity} aria-labelledby={headingId} className="flex flex-col gap-4">
              <GroupHeading id={headingId} severity={severity} count={items.length} />
              <ul className="flex flex-col gap-3">
                {items.map((issue) => (
                  <CriticalFinding key={issue.code} issue={issue} />
                ))}
              </ul>
            </section>
          );
        }
        if (severity === "atencao") {
          return (
            <section key={severity} aria-labelledby={headingId} className="flex flex-col gap-4">
              <GroupHeading id={headingId} severity={severity} count={items.length} />
              <ul className="rounded-xl border border-[var(--color-line)]">
                {items.map((issue) => (
                  <FindingRow key={issue.code} issue={issue} />
                ))}
              </ul>
            </section>
          );
        }
        return (
          <section key={severity} aria-labelledby={headingId} className="flex flex-col gap-4">
            <GroupHeading id={headingId} severity={severity} count={items.length} />
            <details className="rounded-xl border border-dashed border-[var(--color-line-strong)]">
              <ToggleSummary className="flex min-h-14 px-5 text-sm font-semibold sm:px-7">{t.showOptional(items.length)}</ToggleSummary>
              <ul className="border-t border-dashed border-[var(--color-line-strong)] print:border-t-0">
                {items.map((issue) => (
                  <FindingRow key={issue.code} issue={issue} />
                ))}
              </ul>
            </details>
          </section>
        );
      })}
    </div>
  );
}
