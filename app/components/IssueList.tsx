"use client";

import { useState } from "react";
import { prioritizeIssues, type Issue, type IssueSeverity } from "@/lib/issues";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { translateIssue } from "@/app/i18n/translations";

// CLAUDE.md: show the 1-2 most important findings up front, the rest
// behind "show more".
const COLLAPSED_COUNT = 2;

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

function IssueItem({ issue }: { issue: Issue }) {
  const { locale, t } = useLanguage();
  const { title, description } = translateIssue(locale, issue.code, issue.params);
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
