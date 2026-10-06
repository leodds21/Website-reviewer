"use client";

import { useEffect, useState } from "react";
import { SEVERITY_TEXT, SeverityMark } from "./SeverityMark";
import { useLanguage } from "@/app/i18n/LanguageContext";
import type { CategoryKey } from "@/app/i18n/translations";
import type { AnalyzeReport } from "@/lib/report";
import type { IssueSeverity } from "@/lib/issues";
import type { CategoryScore, Severity } from "@/lib/score";

const CATEGORY_KEYS: CategoryKey[] = ["performance", "seo", "accessibility", "security"];

const SEGMENTS = 10;

const SEGMENT_FILL: Record<Severity, string> = {
  ok: "bg-[var(--color-severity-ok)]",
  atencao: "bg-[var(--color-severity-atencao)]",
  critico: "bg-[var(--color-severity-critico)]",
  indisponivel: "bg-[var(--color-line-strong)]",
};

/**
 * The overall score as ten segments that fill in one after another on
 * arrival: an animated progress read of the number beside it, not a
 * bare figure. A segment partly earned shows dimmed.
 */
function ScoreMeter({ score, severity }: { score: number; severity: Severity }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div aria-hidden="true" className="grid grid-cols-10 gap-[3px]">
      {Array.from({ length: SEGMENTS }, (_, index) => {
        const share = Math.min(Math.max(score / 10 - index, 0), 1);
        const lit = filled && share > 0;
        return (
          <span
            key={index}
            className={`h-[5px] transition-colors duration-300 ${lit ? SEGMENT_FILL[severity] : "bg-[var(--color-line)]"}`}
            style={{ transitionDelay: `${index * 45}ms`, opacity: lit && share < 1 ? 0.45 : 1 }}
          />
        );
      })}
    </div>
  );
}

function CategoryRow({ category, result }: { category: CategoryKey; result: CategoryScore }) {
  const { t } = useLanguage();
  // Every category answers something: its score, or why it couldn't be
  // measured ("?? unknown" covers reports cached before reasons existed).
  const note =
    result.score === null
      ? (t.unavailableReason[result.reason] ?? t.unavailableReason.unknown)
      : result.partial
        ? t.partialMeasure
        : null;

  return (
    <li className="border-b border-[var(--color-line)] py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-[15px] text-[var(--color-body)]">
          <SeverityMark kind={result.severity} />
          {t.categories[category]}
        </span>
        <span className={`font-mono text-[15px] ${SEVERITY_TEXT[result.severity]}`}>
          {result.score === null ? t.severity.indisponivel : result.score}
          {result.score !== null && <span className="sr-only"> · {t.severity[result.severity]}</span>}
        </span>
      </div>
      {note && <p className="mt-1 pl-[18px] text-xs leading-snug text-[var(--color-subtle)]">{note}</p>}
    </li>
  );
}

export function ScoreSummary({ report }: { report: AnalyzeReport }) {
  const { t } = useLanguage();
  const measured = CATEGORY_KEYS.filter((key) => report.score[key].score !== null).length;

  const counts: Record<IssueSeverity, number> = { critico: 0, atencao: 0, sugestao: 0 };
  for (const issue of report.issues) counts[issue.severity]++;
  const summary = t.issueSummary(counts);

  const { overall, overallSeverity } = report.score;
  const label =
    overallSeverity === "ok" ? t.scoreLabelOk : overallSeverity === "critico" ? t.scoreLabelCritical : t.scoreLabelAttention;

  return (
    <aside
      aria-label={t.overallScore}
      className="flex flex-col gap-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-6 lg:sticky lg:top-6"
    >
      <div className="flex flex-col gap-2.5">
        <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-label)] uppercase">{t.overallScore}</span>
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-[84px] leading-[0.9] font-medium tracking-[-0.05em] text-[var(--color-text)]">{overall}</span>
          <span className="font-mono text-sm text-[var(--color-subtle)]">/100</span>
        </div>
        <ScoreMeter score={overall} severity={overallSeverity} />
        <p className={`text-base font-semibold ${SEVERITY_TEXT[overallSeverity]}`}>{label}</p>
        {summary.length > 0 && (
          <p className="text-[13px] text-[var(--color-subtle)]">
            {summary.map((part, index) => (
              <span key={part} className="whitespace-nowrap">
                {index > 0 && " · "}
                {part}
              </span>
            ))}
          </p>
        )}
        {measured < CATEGORY_KEYS.length && (
          <p className="text-xs leading-snug text-[var(--color-subtle)]">{t.coverageNote(measured)}</p>
        )}
      </div>

      <ul className="flex flex-col border-t border-[var(--color-line)]">
        {CATEGORY_KEYS.map((key) => (
          <CategoryRow key={key} category={key} result={report.score[key]} />
        ))}
      </ul>

      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-[13px] text-[var(--color-link)] hover:underline [&::-webkit-details-marker]:hidden">
          {t.scoreExplanationToggle}
          <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">{t.scoreExplanation}</p>
      </details>
    </aside>
  );
}
