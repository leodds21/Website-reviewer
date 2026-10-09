import { useEffect, useRef } from "react";
import type { Stage } from "./useAnalysis";

const PARAM = "url";

type LinkedStage = Exclude<Stage, "analyzing">;

function linkedSite(): string | null {
  return new URLSearchParams(window.location.search).get(PARAM);
}

function addressFor(site: string | null): string {
  const next = new URL(window.location.href);
  if (site) next.searchParams.set(PARAM, site);
  else next.searchParams.delete(PARAM);
  return `${next.pathname}${next.search}${next.hash}`;
}

/**
 * Keeps the report in the address bar (?url=) and each screen in history.
 * An entry that already matches the screen is left alone, so back/forward
 * doesn't push duplicates.
 */
export function useReportLink({
  stage,
  setStage,
  analyzedUrl,
  hasReport,
  run,
}: {
  stage: Stage;
  setStage: (stage: Stage) => void;
  analyzedUrl: string;
  hasReport: boolean;
  run: (site: string, options?: { cachedOnly?: boolean }) => void;
}) {
  // While a link opens, its entry is replaced, not stacked on.
  const openingLink = useRef(false);
  // No ref guard: a remount aborts the first run, so it must run again.
  useEffect(() => {
    const site = linkedSite();
    if (!site) return;
    openingLink.current = true;
    run(site, { cachedOnly: true });
  }, [run]);

  useEffect(() => {
    if (stage === "analyzing") return;
    if (openingLink.current) {
      // Still opening, or it failed: the link stays as it is.
      if (stage === "idle") return;
      openingLink.current = false;
      window.history.replaceState({ stage }, "", addressFor(analyzedUrl));
      return;
    }

    const tagged = window.history.state?.stage as LinkedStage | undefined;
    const current = linkedSite();
    const site = stage === "idle" ? null : analyzedUrl;
    if (tagged === stage && current === site) return;
    const entry = { stage };
    // The page's own first entry (untagged) is claimed, not stacked on.
    if (tagged === undefined && current === site) window.history.replaceState(entry, "", addressFor(site));
    else window.history.pushState(entry, "", addressFor(site));
  }, [stage, analyzedUrl]);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const site = linkedSite();
      const wanted = (event.state?.stage as LinkedStage | undefined) ?? (site ? "report" : "idle");
      if (!site || wanted === "idle") setStage("idle");
      else if (hasReport && site === analyzedUrl) setStage(wanted);
      else {
        openingLink.current = true;
        run(site, { cachedOnly: true });
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [hasReport, analyzedUrl, run, setStage]);
}

export function backToReport(setStage: (stage: Stage) => void) {
  if (window.history.state?.stage === "next-step") window.history.back();
  else setStage("report");
}
