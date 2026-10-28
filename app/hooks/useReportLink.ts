import { useEffect, useRef } from "react";
import type { Stage } from "./useAnalysis";
import type { Locale } from "@/app/i18n/locale";
import type { AnalyzeReport } from "@/lib/report";

type LinkedStage = Exclude<Stage, "analyzing">;

// What we keep in each history entry. `run` names the analysis the entry
// belongs to, so going back to an older one never shows the current report.
type Entry = { stage: LinkedStage; run: string; reportId?: string };

function addressFor(locale: Locale, stage: LinkedStage, reportId: string | undefined): string {
  return stage === "idle" || !reportId ? `/${locale}` : `/${locale}/report/${reportId}`;
}

function currentEntry(): Partial<Entry> {
  const state = window.history.state as Partial<Entry> | null;
  return { stage: state?.stage, run: state?.run, reportId: state?.reportId };
}

/**
 * Keeps each screen in browser history, tagged with its stage and run, and
 * the report at its own address (/pt-BR/report/<id>) once it has an id. The
 * next step is an entry with the report's address, not a route.
 *
 * Only our own fields are passed to pushState/replaceState: Next copies its
 * internal state in and syncs usePathname, which it skips when that state is
 * passed back in. Its tree stays the same, so back and forward never refetch.
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
  onPrefill: (site: string, fromPortfolio: boolean) => void;
}) {
  const reportId = report?.id;
  const run = useRef("");
  const loaded = useRef(false);

  // The entry the page loaded on takes the screen the page rendered: a reload
  // on the next step comes back to its report. Later changes are the next
  // effect's job.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const params = new URLSearchParams(window.location.search);
    const site = params.get("url");
    // lsdias.dev's scanner section sends the address someone just typed there.
    if (site) onPrefill(site, params.get("from") === "portfolio");

    run.current = crypto.randomUUID();
    const stage: LinkedStage = reportId ? "report" : "idle";
    const entry: Entry = { stage, run: run.current, ...(reportId && { reportId }) };
    // On the first render Next patches history after its children's effects,
    // so this write goes straight to the browser and must keep Next's own
    // fields (without them, Next reloads the page on back/forward).
    window.history.replaceState({ ...window.history.state, ...entry }, "");
    // Dropping ?url= waits for Next's patch, so useSearchParams sees it too.
    if (site) setTimeout(() => window.history.replaceState(entry, "", addressFor(locale, stage, reportId)));
  }, [locale, onPrefill, reportId]);

  useEffect(() => {
    if (stage === "analyzing") {
      run.current = crypto.randomUUID();
      return;
    }
    const tagged = currentEntry();
    const address = addressFor(locale, stage, reportId);
    const entry: Entry = { stage, run: run.current, ...(reportId && { reportId }) };
    // Same screen of the same run: only the id and address can be behind.
    if (tagged.stage === stage && tagged.run === run.current) {
      if (tagged.reportId !== reportId || window.location.pathname !== address) window.history.replaceState(entry, "", address);
      return;
    }
    window.history.pushState(entry, "", address);
  }, [stage, reportId, locale]);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const entry = event.state as Partial<Entry> | null;
      if (!entry?.stage) return;
      if (entry.stage === "idle") return setStage("idle");
      if (entry.run === run.current) return setStage(entry.stage);
      // Another analysis's report: the server renders it from its address.
      if (entry.reportId) return window.location.reload();
      // An earlier partial report that never got an id can't be shown again.
      window.history.replaceState({ stage: "idle", run: run.current } satisfies Entry, "", `/${locale}`);
      setStage("idle");
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setStage, locale]);
}

/** The in-app "back to report": a real history step when the next step was pushed as one. */
export function backToReport(setStage: (stage: Stage) => void) {
  if (window.history.state?.stage === "next-step") window.history.back();
  else setStage("report");
}
