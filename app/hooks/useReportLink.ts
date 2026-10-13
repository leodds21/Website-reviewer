import { useEffect, useRef } from "react";
import type { Stage } from "./useAnalysis";
import type { Locale } from "@/app/i18n/locale";
import type { AnalyzeReport } from "@/lib/report";

type LinkedStage = Exclude<Stage, "analyzing">;

const REPORT_PATH = /^\/(?:pt-BR|en)\/report\/([0-9A-Za-z]+)$/;

function reportIdInPath(): string | null {
  return REPORT_PATH.exec(window.location.pathname)?.[1] ?? null;
}

function addressFor(locale: Locale, stage: LinkedStage, reportId: string | undefined): string {
  return stage === "idle" || !reportId ? `/${locale}` : `/${locale}/report/${reportId}`;
}

function taggedStage(): LinkedStage | undefined {
  return window.history.state?.stage as LinkedStage | undefined;
}

/**
 * Keeps each screen in browser history, tagged with its stage, and the
 * report at its own address (/pt-BR/report/<id>) once it has an id. The next
 * step is an entry with the report's address, not a route.
 *
 * Native pushState is enough: Next keeps the current tree for these entries,
 * so back and forward never refetch or remount.
 */
export function useReportLink({
  locale,
  stage,
  setStage,
  report,
  onPrefill,
}: {
  locale: Locale;
  stage: Stage;
  setStage: (stage: Stage) => void;
  report: AnalyzeReport | null;
  onPrefill: (site: string) => void;
}) {
  const reportId = report?.id;
  const hasReport = report !== null;
  // Read by the popstate listener, which outlives a single render.
  const latest = useRef({ reportId, hasReport });
  useEffect(() => {
    latest.current = { reportId, hasReport };
  }, [reportId, hasReport]);
  const mounted = useRef(false);

  // The entry the page loaded on: a reload keeps its tag, e.g. the next step.
  useEffect(() => {
    const site = new URLSearchParams(window.location.search).get("url");
    if (site) onPrefill(site);

    const tagged = taggedStage();
    const hasReport = latest.current.hasReport;
    if (hasReport && tagged === "next-step") setStage("next-step");
    const stage: LinkedStage = hasReport ? (tagged === "next-step" ? "next-step" : "report") : "idle";
    window.history.replaceState({ ...window.history.state, stage }, "", addressFor(locale, stage, latest.current.reportId));
  }, [locale, onPrefill, setStage]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (stage === "analyzing") return;
    const address = addressFor(locale, stage, reportId);
    // Same screen: only the address can be behind, when the id arrives late.
    if (taggedStage() === stage) {
      if (window.location.pathname !== address) window.history.replaceState(window.history.state, "", address);
      return;
    }
    window.history.pushState({ stage }, "", address);
  }, [stage, reportId, locale]);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const stage = event.state?.stage as LinkedStage | undefined;
      if (!stage) return;
      if (stage === "idle") return setStage("idle");
      // Another report than the one in memory: let the server render it.
      const pathId = reportIdInPath();
      if (!latest.current.hasReport || (pathId && pathId !== latest.current.reportId)) return window.location.reload();
      setStage(stage);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setStage]);
}

/** The in-app "back to report": a real history step when the next step was pushed as one. */
export function backToReport(setStage: (stage: Stage) => void) {
  if (window.history.state?.stage === "next-step") window.history.back();
  else setStage("report");
}
