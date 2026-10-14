"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader, Brand, ErrorNote, PageContainer, buttonClass } from "../components/Chrome";
import { SEVERITY_TEXT } from "../components/SeverityMark";
import { useLanguage } from "../i18n/LanguageContext";
import { translateAnalysisError, translateIssue } from "../i18n/translate";
import type { BatchStatus, Dictionary } from "../i18n/types";
import type { Locale } from "../i18n/locale";
import { parseBatchList } from "@/lib/batchList";
import { analyzeForBatch, runPool } from "@/lib/batchRun";
import { toCsv, type CsvCell } from "@/lib/batchCsv";
import { topIssues } from "@/lib/issues";
import type { AnalyzeReport } from "@/lib/report";
import type { AnalyzeError } from "@/lib/analyzeError";

// Each analysis is one PageSpeed run; two at a time keeps Google's quota and
// the server's functions comfortable.
const CONCURRENCY = 2;
const TOKEN_KEY = "batch-token";
const CATEGORIES = ["performance", "seo", "accessibility", "security"] as const;

type Row = { url: string; status: BatchStatus; report?: AnalyzeReport; error?: AnalyzeError };

// Storage can be off (private mode, blocked site data); the code is then asked each time.
function readToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Same as above.
  }
}

const overallOf = (report: AnalyzeReport) =>
  report.score.overallSeverity === "indisponivel" || report.score.overallSeverity === "pendente" ? null : report.score.overall;

const criticalCount = (report: AnalyzeReport) => report.issues.filter((issue) => issue.severity === "critico").length;

function topIssueTitle(t: Dictionary, report: AnalyzeReport): string {
  const [top] = topIssues(report.issues, report.score);
  return top ? translateIssue(t, top.code, top.params).title : "";
}

function statusText(t: Dictionary, row: Row): string {
  return row.status === "failed" && row.error ? `${t.batch.status.failed}: ${translateAnalysisError(t, row.error)}` : t.batch.status[row.status];
}

function downloadCsv(t: Dictionary, locale: Locale, rows: Row[]): void {
  const header: CsvCell[] = [
    t.batch.columns.site,
    t.batch.columns.status,
    t.batch.columns.overall,
    ...CATEGORIES.map((key) => t.categories[key]),
    t.batch.columns.critical,
    t.batch.columns.topIssue,
    t.batch.columns.report,
  ];
  const body = rows.map(({ report, ...row }): CsvCell[] => [
    report?.domain ?? row.url,
    statusText(t, { report, ...row }),
    report ? overallOf(report) : null,
    ...CATEGORIES.map((key) => report?.score[key].score ?? null),
    report ? criticalCount(report) : null,
    report ? topIssueTitle(t, report) : null,
    report?.id ? `${window.location.origin}/${locale}/report/${report.id}` : null,
  ]);
  // The BOM makes Excel read the accents as UTF-8.
  const csv = `﻿${toCsv([header, ...body], locale === "pt-BR" ? ";" : ",")}`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `${t.batch.fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Not linked anywhere and not indexed: a tool for whoever holds BATCH_TOKEN. */
export function BatchPage() {
  const { locale, t } = useLanguage();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<AnalyzeError | null>(null);
  const [overLimit, setOverLimit] = useState(0);
  const tokenRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Filled after hydration, straight into the field: the server can't see this tab's storage.
  useEffect(() => {
    if (tokenRef.current && !tokenRef.current.value) tokenRef.current.value = readToken();
    return () => abortRef.current?.abort();
  }, []);

  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = tokenRef.current?.value.trim() ?? "";
    const list = parseBatchList(text);
    if (!token || list.urls.length === 0) return;
    saveToken(token);

    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setOverLimit(list.overLimit);
    setRows(list.urls.map((url) => ({ url, status: "queued" })));
    setRunning(true);

    try {
      await runPool(list.urls, CONCURRENCY, async (url, index) => {
        if (controller.signal.aborted) return;
        update(index, { status: "running" });
        // Throws only when stopped; that row then shows as not run.
        const outcome = await analyzeForBatch(url, token, controller.signal).catch(() => null);
        if (!outcome) return;
        if (outcome.ok) return update(index, { status: "done", report: outcome.report });
        update(index, { status: "failed", error: outcome.error });
        // A wrong code would fail every row the same way: stop and say it once.
        if (outcome.error.code === "unauthorized") {
          setError(outcome.error);
          controller.abort();
        }
      });
    } finally {
      setRows((current) => current.map((row) => (row.status === "queued" || row.status === "running" ? { ...row, status: "skipped" } : row)));
      setRunning(false);
    }
  }

  const finished = rows.filter((row) => row.status === "done" || row.status === "failed").length;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader>
        <Brand />
      </AppHeader>
      <PageContainer className="flex flex-1 flex-col gap-8 py-10 sm:py-14">
        <section className="flex max-w-2xl flex-col gap-5">
          <h1 className="font-heading text-4xl tracking-[-0.03em]">{t.batch.title}</h1>
          <p className="text-[15px] leading-relaxed text-[var(--color-muted)]">{t.batch.intro}</p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="batch-urls" className="text-sm font-semibold text-[var(--color-body)]">
                {t.batch.urlsLabel}
              </label>
              <textarea
                id="batch-urls"
                rows={8}
                spellCheck={false}
                disabled={running}
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-field)] px-4 py-3 font-mono text-sm leading-relaxed text-[var(--color-text)] disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="batch-token" className="text-sm font-semibold text-[var(--color-body)]">
                {t.batch.tokenLabel}
              </label>
              <input
                id="batch-token"
                ref={tokenRef}
                type="password"
                autoComplete="off"
                disabled={running}
                aria-describedby="batch-token-hint"
                className="min-h-12 max-w-sm rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-field)] px-4 font-mono text-sm text-[var(--color-text)] disabled:opacity-60"
              />
              <p id="batch-token-hint" className="text-xs text-[var(--color-subtle)]">
                {t.batch.tokenHint}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {running ? (
                <button type="button" onClick={() => abortRef.current?.abort()} className={buttonClass.secondary}>
                  {t.batch.stop}
                </button>
              ) : (
                <button type="submit" disabled={!text.trim()} className={`${buttonClass.primary} disabled:cursor-not-allowed disabled:opacity-60`}>
                  {t.batch.run}
                </button>
              )}
              {!running && rows.some((row) => row.report) && (
                <button type="button" onClick={() => downloadCsv(t, locale, rows)} className={buttonClass.secondary}>
                  {t.batch.download}
                </button>
              )}
            </div>
          </form>

          {error && <ErrorNote>{translateAnalysisError(t, error)}</ErrorNote>}
          {overLimit > 0 && <p className="text-sm text-[var(--color-muted)]">{t.batch.overLimit(overLimit)}</p>}
        </section>

        {rows.length > 0 && (
          <section className="flex flex-col gap-3">
            <p role="status" className="font-mono text-xs tracking-[0.14em] text-[var(--color-subtle)] uppercase">
              {t.batch.progress(finished, rows.length)}
            </p>
            {/* The table scrolls on its own on a phone; the page doesn't. "relative"
                keeps the links' screen-reader text inside it too. */}
            <div className="relative overflow-x-auto rounded-lg border border-[var(--color-line)]">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-[var(--color-line)] font-mono text-[11px] tracking-[0.12em] text-[var(--color-label)] uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-normal">{t.batch.columns.site}</th>
                    <th scope="col" className="px-4 py-3 font-normal">{t.batch.columns.status}</th>
                    <th scope="col" className="px-3 py-3 text-right font-normal">{t.batch.columns.overall}</th>
                    {CATEGORIES.map((key) => (
                      <th key={key} scope="col" className="px-3 py-3 text-right font-normal">
                        {t.categories[key]}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-3 text-right font-normal">{t.batch.columns.critical}</th>
                    <th scope="col" className="px-4 py-3 font-normal">{t.batch.columns.topIssue}</th>
                    <th scope="col" className="px-4 py-3 font-normal">{t.batch.columns.report}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const { report } = row;
                    const overall = report ? overallOf(report) : null;
                    return (
                      <tr key={`${index}-${row.url}`} className="border-b border-[var(--color-line)] last:border-b-0 align-top">
                        <th scope="row" className="min-w-52 px-4 py-3 font-mono text-[13px] font-normal break-all text-[var(--color-text)]">
                          {report?.domain ?? row.url}
                        </th>
                        <td className={`min-w-36 px-4 py-3 ${row.status === "failed" ? "text-[var(--color-severity-critico-text)]" : "text-[var(--color-muted)]"}`}>
                          {statusText(t, row)}
                        </td>
                        <td className={`px-3 py-3 text-right font-mono font-semibold ${report && overall !== null ? SEVERITY_TEXT[report.score.overallSeverity] : ""}`}>
                          {overall ?? "–"}
                        </td>
                        {CATEGORIES.map((key) => {
                          const category = report?.score[key];
                          return (
                            <td key={key} className={`px-3 py-3 text-right font-mono ${category && category.score !== null ? SEVERITY_TEXT[category.severity] : ""}`}>
                              {category?.score ?? "–"}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-right font-mono">{report ? criticalCount(report) : "–"}</td>
                        <td className="min-w-56 px-4 py-3 text-[var(--color-body)]">{report ? topIssueTitle(t, report) : ""}</td>
                        <td className="px-4 py-3">
                          {report?.id && (
                            <a href={`/${locale}/report/${report.id}`} target="_blank" rel="noopener" className="text-[var(--color-link)] underline">
                              {t.batch.openReport}
                              <span className="sr-only"> ({t.opensNewTab})</span>
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </PageContainer>
    </div>
  );
}
