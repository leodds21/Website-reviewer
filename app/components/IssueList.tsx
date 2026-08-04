"use client";

import { useState } from "react";
import type { Issue } from "@/lib/issues";

const CATEGORY_LABEL: Record<Issue["category"], string> = {
  performance: "Performance",
  seo: "SEO",
  accessibility: "Acessibilidade",
  security: "Segurança",
};

export function IssueList({ issues }: { issues: Issue[] }) {
  const [expanded, setExpanded] = useState(false);

  const critical = issues.filter((issue) => issue.severity === "critico");
  const secondary = issues.filter((issue) => issue.severity === "atencao");
  const visibleSecondary = expanded ? secondary : secondary.slice(0, Math.max(0, 2 - critical.length));
  const hiddenCount = secondary.length - visibleSecondary.length;

  if (issues.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--color-neutral-600)]">
        Não encontramos problema nenhum nas checagens que rodamos.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-lg">O que encontramos</h3>
        <span className="border-0 bg-[var(--color-neutral-200)] px-2.5 py-0.5 text-[11px]">
          {issues.length} {issues.length === 1 ? "ponto" : "pontos"}
        </span>
      </div>

      <div className="flex flex-col gap-3.5">
        {critical.map((issue, index) => (
          <div key={`critico-${index}`} className="border-l-[3px] border-[var(--color-accent-900)] pl-3">
            <div className="mb-0.5 text-[10.5px] font-semibold tracking-[0.08em] text-[var(--color-accent-900)] uppercase">
              ■ Crítico · {CATEGORY_LABEL[issue.category]}
            </div>
            <div className="mb-0.5 text-[16.5px] leading-tight font-semibold">{issue.title}</div>
            <p className="text-[12.5px] text-[var(--color-text)]/70">{issue.description}</p>
          </div>
        ))}

        {visibleSecondary.map((issue, index) => (
          <div key={`atencao-${index}`} className="border-l-2 border-[var(--color-divider)] pl-3">
            <div className="text-xs text-[var(--color-text)]/80">
              □ {issue.title} <i className="text-[var(--color-neutral-600)] not-italic">· {CATEGORY_LABEL[issue.category]}</i>
            </div>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 text-[12.5px] text-[var(--color-accent)] hover:underline"
        >
          Mostrar mais {hiddenCount} {hiddenCount === 1 ? "problema" : "problemas"} ⌄
        </button>
      )}
    </div>
  );
}
