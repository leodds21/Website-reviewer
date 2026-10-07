"use client";

import { useEffect, useState } from "react";
import { ToggleSummary } from "./Chrome";
import { SEVERITY_TEXT, SeverityMark } from "./SeverityMark";
import { useLanguage } from "@/app/i18n/LanguageContext";
import type { CategoryKey } from "@/app/i18n/translations";
import type { AnalyzeReport } from "@/lib/report";
import type { IssueSeverity } from "@/lib/issues";
import type { CategoryScore, ScoreComponent, Severity } from "@/lib/score";

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

/** One line of a breakdown: a label that wraps, its number kept to the right. Never a table, so it reads at 320px. */
function BreakdownLine({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1.5 ${total ? "font-semibold text-[var(--color-text)]" : "border-b border-[var(--color-line)]/70"}`}
    >
      <dt className="min-w-0">{label}</dt>
      <dd className="shrink-0 font-mono tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Why a category got its score, from the measurements it was actually
 * averaged from (lib/score.ts): from 100, what each one took off, most
 * first. A score that comes from a single measurement says where it
 * comes from instead of dressing it up as 100-minus-something.
 */
function ScoreBreakdown({ score, components }: { score: number; components: ScoreComponent[] }) {
  const { t } = useLanguage();

  if (components.length === 1) {
    const [only] = components;
    const sentence =
      only.key === "google-performance"
        ? t.scoreFromGoogle(only.value)
        : only.key === "https" && only.value === 0
          ? t.securityWithoutHttps
          : `${t.scoreSingleMeasurement} ${t.scoreComponent[only.key](only.value)}.`;
    return <p className="pb-1 text-xs leading-relaxed text-[var(--color-muted)]">{sentence}</p>;
  }

  // Array sort is stable: equal losses keep the measurements' own order.
  const byLoss = [...components].sort((a, b) => b.lost - a.lost);
  return (
    <div className="flex flex-col gap-1.5 pb-1 text-xs text-[var(--color-muted)]">
      <p className="leading-relaxed">{t.scoreBreakdownIntro(components.length)}</p>
      <dl className="flex flex-col">
        <BreakdownLine label={t.scoreBreakdownStart} value="100" />
        {byLoss.map((component) => (
          <BreakdownLine
            key={component.key}
            label={t.scoreComponent[component.key](component.value)}
            value={component.lost > 0 ? `−${component.lost}` : "0"}
          />
        ))}
        <BreakdownLine label={t.scoreBreakdownTotal} value={String(score)} total />
      </dl>
    </div>
  );
}

function CategoryRow({ category, result, loadSeconds }: { category: CategoryKey; result: CategoryScore; loadSeconds?: number }) {
  const { t } = useLanguage();
  // Every category answers something: its score, or why it couldn't be
  // measured ("?? unknown" covers reports cached before reasons existed).
  // Otherwise, for Performance, the number behind it in plain terms.
  const note =
    result.score === null
      ? (t.unavailableReason[result.reason] ?? t.unavailableReason.unknown)
      : result.partial
        ? t.partialMeasure
        : loadSeconds !== undefined
          ? t.loadTime(loadSeconds)
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
      {/* Reports cached before categories kept their measurements have nothing to break down. */}
      {result.score !== null && result.components && (
        <details className="pl-[18px]">
          <ToggleSummary className="inline-flex min-h-10 text-xs">{t.scoreBreakdownToggle}</ToggleSummary>
          <ScoreBreakdown score={result.score} components={result.components} />
        </details>
      )}
    </li>
  );
}

export function ScoreSummary({ report }: { report: AnalyzeReport }) {
  const { t } = useLanguage();
  const measuredScores = CATEGORY_KEYS.map((key) => report.score[key].score).filter((score): score is number => score !== null);
  const measured = measuredScores.length;

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
          <CategoryRow
            key={key}
            category={key}
            result={report.score[key]}
            loadSeconds={key === "performance" ? report.loadSeconds : undefined}
          />
        ))}
      </ul>

      <details>
        <ToggleSummary className="flex min-h-11 text-[13px]">{t.scoreExplanationToggle}</ToggleSummary>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">{t.scoreExplanation}</p>
        {/* The overall score's own arithmetic: the plain average of the
            category scores above, the same one lib/score.ts takes. */}
        {measured > 1 && (
          <p className="mt-2 font-mono text-xs text-[var(--color-body)]">
            {t.overallArithmetic(measuredScores, measuredScores.reduce((sum, score) => sum + score, 0) / measured, overall)}
          </p>
        )}
      </details>
    </aside>
  );
}
