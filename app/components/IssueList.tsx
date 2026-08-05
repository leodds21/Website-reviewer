"use client";

import { useState } from "react";
import type { Issue } from "@/lib/issues";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { translateIssue } from "@/app/i18n/translations";

export function IssueList({ issues }: { issues: Issue[] }) {
  const { locale, t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const critical = issues.filter((issue) => issue.severity === "critico");
  const secondary = issues.filter((issue) => issue.severity === "atencao");
  // CLAUDE.md: show the 1-2 most critical issues, rest behind "show
  // more" — this used to only ever collapse `atencao` items, so a site
  // with e.g. 5 critical findings dumped all 5 unconditionally.
  const visibleCritical = expanded ? critical : critical.slice(0, 2);
  const visibleSecondary = expanded ? secondary : secondary.slice(0, Math.max(0, 2 - critical.length));
  const hiddenCount = critical.length - visibleCritical.length + (secondary.length - visibleSecondary.length);

  if (issues.length === 0) {
    return <p className="text-[12.5px] text-[var(--color-neutral-700)]">{t.noIssues}</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-lg">{t.whatWeFound}</h3>
        <span className="border-0 bg-[var(--color-neutral-200)] px-2.5 py-0.5 text-[11px]">
          {t.points(issues.length)}
        </span>
      </div>

      <div className="flex flex-col gap-3.5">
        {visibleCritical.map((issue, index) => {
          const { title, description } = translateIssue(locale, issue.code, issue.params);
          return (
            <div key={`critico-${index}`} className="border-l-[3px] border-[var(--color-accent-900)] pl-3">
              <div className="mb-0.5 text-[10.5px] font-semibold tracking-[0.08em] text-[var(--color-accent-900)] uppercase">
                <span aria-hidden="true">■</span> {t.severity.critico} · {t.categories[issue.category]}
              </div>
              <div className="mb-0.5 text-[16.5px] leading-tight font-semibold">{title}</div>
              <p className="text-[12.5px] text-[var(--color-text)]/70">{description}</p>
            </div>
          );
        })}

        {visibleSecondary.map((issue, index) => {
          const { title } = translateIssue(locale, issue.code, issue.params);
          return (
            <div key={`atencao-${index}`} className="border-l-2 border-[var(--color-divider)] pl-3">
              <div className="text-xs text-[var(--color-text)]/80">
                <span aria-hidden="true">□</span> {title}{" "}
                <i className="text-[var(--color-neutral-700)] not-italic">· {t.categories[issue.category]}</i>
              </div>
            </div>
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 text-[12.5px] text-[var(--color-accent-700)] hover:underline"
        >
          {t.showMore(hiddenCount)}
        </button>
      )}
    </div>
  );
}
