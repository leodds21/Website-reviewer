"use client";

import { useState } from "react";
import { prioritizeIssues, type Issue, type IssueSeverity } from "@/lib/issues";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { translateIssue, translateRecommendation } from "@/app/i18n/translations";

// CLAUDE.md: show the 1-2 most important findings up front, the rest
// behind "show more".
const COLLAPSED_COUNT = 2;

// Enough to locate the problem; the checks themselves sample at most
// 20 images and 10 links.
const MAX_AFFECTED_SHOWN = 10;

// Severity reads through several signals at once, never color alone:
// the label, the bar's weight, and the title's size and weight.
// Suggestions stay neutral: they're opportunities, not warnings.
const SEVERITY_STYLE: Record<IssueSeverity, { color: string; bar: string; title: string; body: string }> = {
  critico: {
    color: "var(--color-severity-critico)",
    bar: "border-l-[3px]",
    title: "text-[15.5px] font-semibold",
    body: "text-[12.5px] text-[var(--color-text)]/70",
  },
  atencao: {
    color: "var(--color-severity-atencao)",
    bar: "border-l-2",
    title: "text-[13.5px] font-medium",
    body: "text-[12px] text-[var(--color-neutral-700)]",
  },
  sugestao: {
    color: "var(--color-neutral-700)",
    bar: "border-l",
    title: "text-[13px]",
    body: "text-[12px] text-[var(--color-neutral-700)]",
  },
};

function AffectedList({ issue }: { issue: Issue }) {
  const { t } = useLanguage();
  const affected = issue.affected ?? [];
  const heading = t.affectedHeading[issue.code];
  if (affected.length === 0 || !heading) return null;

  const hidden = affected.length - MAX_AFFECTED_SHOWN;
  return (
    <div className="mt-2">
      <p className="text-[11px] font-medium text-[var(--color-neutral-700)]">{heading(affected.length)}</p>
      {/* Plain text on purpose: these addresses come from the analyzed
          site, so they're never rendered as links we'd be vouching for. */}
      <ul className="mt-1 flex flex-col gap-0.5 font-mono text-[11px] break-all text-[var(--color-text)]/80">
        {affected.slice(0, MAX_AFFECTED_SHOWN).map((item, index) => (
          <li key={`${index}-${item}`}>{item || t.imageWithoutSource}</li>
        ))}
      </ul>
      {hidden > 0 && <p className="mt-0.5 text-[11px] text-[var(--color-neutral-700)]">{t.moreAffected(hidden)}</p>}
    </div>
  );
}

function IssueItem({ issue }: { issue: Issue }) {
  const { locale, t } = useLanguage();
  const { title, description } = translateIssue(locale, issue.code, issue.params);
  const recommendation = translateRecommendation(locale, issue.code);
  const style = SEVERITY_STYLE[issue.severity];

  return (
    <li className={`${style.bar} pl-3`} style={{ borderColor: style.color }}>
      <div className="mb-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase">
        <span style={{ color: style.color }}>{t.severity[issue.severity]}</span>
        <span aria-hidden="true" className="text-[var(--color-divider)]">
          ·
        </span>
        <span className="text-[var(--color-neutral-700)]">{t.categories[issue.category]}</span>
      </div>
      <p className={`mb-0.5 leading-tight ${style.title}`}>{title}</p>
      <p className={style.body}>{description}</p>
      {/* Closed by default: the list stays scannable, and the fix is one
          tap away for whoever is going to do it. */}
      {recommendation && (
        <details className="group mt-1">
          <summary className="-my-1 flex w-fit cursor-pointer list-none items-center gap-1 py-1.5 text-[11.5px] text-[var(--color-accent-700)] hover:underline focus-visible:underline [&::-webkit-details-marker]:hidden">
            {t.howToFix}
            <span className="inline-block transition-transform group-open:rotate-180" aria-hidden="true">
              ⌄
            </span>
          </summary>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text)]/80">{recommendation}</p>
          <AffectedList issue={issue} />
        </details>
      )}
    </li>
  );
}

export function IssueList({ issues }: { issues: Issue[] }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  if (issues.length === 0) {
    return <p className="text-[12.5px] text-[var(--color-neutral-700)]">{t.noIssues}</p>;
  }

  const ordered = prioritizeIssues(issues);
  const visible = expanded ? ordered : ordered.slice(0, COLLAPSED_COUNT);
  const hasMore = ordered.length > COLLAPSED_COUNT;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg">{t.whatWeFound}</h2>
        <span className="bg-[var(--color-neutral-200)] px-2.5 py-0.5 text-[11px] text-[var(--color-neutral-700)]">
          {t.points(issues.length)}
        </span>
      </div>

      <ul className="flex flex-col gap-3.5">
        {visible.map((issue) => (
          <IssueItem key={issue.code} issue={issue} />
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="-mx-1 mt-3 flex items-center gap-1 px-1 py-1 text-[12.5px] font-medium text-[var(--color-accent-700)] transition-colors hover:bg-[var(--color-divider)]/30 hover:underline focus-visible:underline"
        >
          {expanded ? t.showLess : t.showAllPoints(issues.length)}
        </button>
      )}
    </div>
  );
}
