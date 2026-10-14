"use client";

import { useEffect, useState } from "react";
import { ToggleSummary } from "./Chrome";
import { SEVERITY_TEXT, SeverityMark } from "./SeverityMark";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { translateScoreComponent } from "@/app/i18n/translate";
import type { CategoryKey } from "@/app/i18n/types";
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
  pendente: "bg-[var(--color-line-strong)]",
};

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

// Not a table, so it still reads at 320px.
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

// A single-measurement score names its source instead of showing 100 minus something.
function ScoreBreakdown({ score, components }: { score: number; components: ScoreComponent[] }) {
  const { t } = useLanguage();

  if (components.length === 1) {
    const [only] = components;
    const sentence =
      only.key === "google-performance"
        ? t.scoreFromGoogle(only.value)
        : only.key === "https" && only.value === 0
          ? t.securityWithoutHttps
          : `${t.scoreSingleMeasurement} ${translateScoreComponent(t, only)}.`;
    return <p className="pb-1 text-xs leading-relaxed text-[var(--color-muted)]">{sentence}</p>;
  }

  const byLoss = [...components].sort((a, b) => b.lost - a.lost);
  return (
    <div className="flex flex-col gap-1.5 pb-1 text-xs text-[var(--color-muted)]">
      <p className="leading-relaxed">{t.scoreBreakdownIntro(components.length)}</p>
      <dl className="flex flex-col">
        <BreakdownLine label={t.scoreBreakdownStart} value="100" />
        {byLoss.map((component) => (
          <BreakdownLine
            key={component.key}
            label={translateScoreComponent(t, component)}
            value={component.lost > 0 ? `−${component.lost}` : "0"}
          />
        ))}
        <BreakdownLine label={t.scoreBreakdownTotal} value={String(score)} total />
      </dl>
    </div>
  );
}

function CategoryRow({
  category,
  result,
  loadSeconds,
  stopped,
}: {
  category: CategoryKey;
  result: CategoryScore;
  loadSeconds?: number;
  // Google's measurement ended without a result: nothing is still coming.
  stopped: boolean;
}) {
  const { t } = useLanguage();
  const severity = stopped && result.severity === "pendente" ? "indisponivel" : result.severity;
  // "?? unknown" covers a reason from a newer server.
  const note =
    result.severity === "pendente"
      ? stopped
        ? t.pendingFailed
        : t.pendingMeasure
      : result.score === null
        ? (t.unavailableReason[result.reason] ?? t.unavailableReason.unknown)
        : result.pending
          ? stopped
            ? t.partialMeasure
            : t.provisionalMeasure
          : result.partial
            ? t.partialMeasure
            : loadSeconds !== undefined
              ? t.loadTime(loadSeconds)
              : null;

  return (
    <li className="border-b border-[var(--color-line)] py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-[15px] text-[var(--color-body)]">
          <SeverityMark kind={severity} />
          {t.categories[category]}
        </span>
        <span className={`font-mono text-[15px] ${SEVERITY_TEXT[severity]}`}>
          {result.score === null ? t.severity[severity] : result.score}
          {result.score !== null && <span className="sr-only"> · {t.severity[result.severity]}</span>}
        </span>
      </div>
      {note && <p className="mt-1 pl-[18px] text-xs leading-snug text-[var(--color-subtle)]">{note}</p>}
      {result.score !== null && (
        <details className="pl-[18px]">
          <ToggleSummary className="inline-flex min-h-10 text-xs">{t.scoreBreakdownToggle}</ToggleSummary>
          <ScoreBreakdown score={result.score} components={result.components} />
        </details>
      )}
    </li>
  );
}

export function ScoreSummary({ report, unfinished = false }: { report: AnalyzeReport; unfinished?: boolean }) {
  const { t } = useLanguage();
  const measuredScores = CATEGORY_KEYS.map((key) => report.score[key].score).filter((score): score is number => score !== null);
  const measured = measuredScores.length;

  const counts: Record<IssueSeverity, number> = { critico: 0, atencao: 0, sugestao: 0 };
  for (const issue of report.issues) counts[issue.severity]++;
  const summary = t.issueSummary(counts);

  const { overall } = report.score;
  const pending = report.score.overallSeverity === "pendente";
  // A report where nothing could be measured, or whose Google measurement never came, has no overall score.
  const overallSeverity = pending && unfinished ? "indisponivel" : report.score.overallSeverity;
  const noScore = pending || overallSeverity === "indisponivel";
  const label =
    overallSeverity === "pendente"
      ? t.scoreLabelPending
      : overallSeverity === "indisponivel"
        ? t.scoreLabelUnavailable
        : overallSeverity === "ok"
          ? t.scoreLabelOk
          : overallSeverity === "critico"
            ? t.scoreLabelCritical
            : t.scoreLabelAttention;

  return (
    <aside
      aria-label={t.overallScore}
      className="@container flex flex-col gap-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-6 lg:sticky lg:top-6"
    >
      <div className="flex flex-col gap-2.5">
        <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-label)] uppercase">{t.overallScore}</span>
        <div className="flex items-baseline gap-2">
          <span
            className={`font-heading text-[84px] leading-[0.9] font-medium tracking-[-0.05em] ${noScore ? "text-[var(--color-line-strong)]" : "text-[var(--color-text)]"}`}
          >
            {noScore ? <span aria-hidden="true">--</span> : overall}
          </span>
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
        {!noScore && measured < CATEGORY_KEYS.length && (
          <p className="text-xs leading-snug text-[var(--color-subtle)]">{t.coverageNote(measured)}</p>
        )}
      </div>

      {/* Two columns when the panel is wide (full-width on tablets), one in the desktop sidebar. */}
      <ul className="grid border-t border-[var(--color-line)] @[34rem]:grid-cols-2 @[34rem]:gap-x-8">
        {CATEGORY_KEYS.map((key) => (
          <CategoryRow
            key={key}
            category={key}
            result={report.score[key]}
            loadSeconds={key === "performance" ? report.loadSeconds : undefined}
            stopped={unfinished}
          />
        ))}
      </ul>

      <details>
        <ToggleSummary className="flex min-h-11 text-[13px]">{t.scoreExplanationToggle}</ToggleSummary>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">{t.scoreExplanation}</p>
        {!noScore && measured > 1 && (
          <p className="mt-2 font-mono text-xs text-[var(--color-body)]">
            {t.overallArithmetic(measuredScores, measuredScores.reduce((sum, score) => sum + score, 0) / measured, overall)}
          </p>
        )}
      </details>
    </aside>
  );
}
