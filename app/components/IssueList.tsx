"use client";

import { useState } from "react";
import type { Issue, IssueSeverity } from "@/lib/issues";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { translateIssue } from "@/app/i18n/translations";

const SEVERITY_COLOR: Record<IssueSeverity, string> = {
  critico: "var(--color-severity-critico)",
  atencao: "var(--color-severity-atencao)",
};

function IssueItem({ issue }: { issue: Issue }) {
  const { locale, t } = useLanguage();
  const { title, description } = translateIssue(locale, issue.code, issue.params);
  const critical = issue.severity === "critico";
  const color = SEVERITY_COLOR[issue.severity];

  return (
    <div className={critical ? "border-l-[3px] pl-3" : "border-l-2 pl-3"} style={{ borderColor: color }}>
      <div className="mb-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase">
        <span style={{ color }}>{t.severity[issue.severity]}</span>
        <span aria-hidden="true" className="text-[var(--color-divider)]">
          ·
        </span>
        <span className="text-[var(--color-neutral-700)]">{t.categories[issue.category]}</span>
      </div>
      <div className={critical ? "mb-0.5 text-[15.5px] leading-tight font-semibold" : "mb-0.5 text-[13px] leading-tight font-medium"}>
        {title}
      </div>
      <p className={critical ? "text-[12.5px] text-[var(--color-text)]/70" : "text-[12px] text-[var(--color-neutral-700)]"}>
        {description}
      </p>
    </div>
  );
}

export function IssueList({ issues }: { issues: Issue[] }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const critical = issues.filter((issue) => issue.severity === "critico");
  const secondary = issues.filter((issue) => issue.severity === "atencao");

  // CLAUDE.md: show the 1-2 most critical issues, rest behind a "show
  // more" action — computed independently of `expanded` so hasMore
  // stays true (and the toggle stays visible) once the list opens.
  const collapsedCritical = critical.slice(0, 2);
  const collapsedSecondary = secondary.slice(0, Math.max(0, 2 - critical.length));
  const hasMore = issues.length > collapsedCritical.length + collapsedSecondary.length;

  const visibleCritical = expanded ? critical : collapsedCritical;
  const visibleSecondary = expanded ? secondary : collapsedSecondary;

  if (issues.length === 0) {
    return <p className="text-[12.5px] text-[var(--color-neutral-700)]">{t.noIssues}</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg">{t.whatWeFound}</h2>
        <span className="border-0 bg-[var(--color-neutral-200)] px-2.5 py-0.5 text-[11px] text-[var(--color-neutral-700)]">
          {t.points(issues.length)}
        </span>
      </div>

      <div className="flex flex-col gap-3.5">
        {visibleCritical.map((issue, index) => (
          <IssueItem key={`critico-${index}`} issue={issue} />
        ))}
        {visibleSecondary.map((issue, index) => (
          <IssueItem key={`atencao-${index}`} issue={issue} />
        ))}
      </div>

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
