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
 * Mirrors the open report in the address bar (?url=site.com), so the
 * link can be sent to someone, a reload reopens the report, and the
 * browser's back button moves between home, report and contact step
 * instead of leaving the app. Opening a link shows its report while
 * the server still has it cached (6 hours); after that, the home screen
 * with the address filled in and an offer to run it again, so a link
 * alone never starts an analysis.
 *
 * Each screen is a history entry tagged with its stage. An entry that
 * already matches the screen (after a back/forward) is left alone,
 * which is what keeps popstate and the stage changes it causes from
 * pushing duplicates.
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
  // True from opening a link (or reloading one) until its report is up:
  // that entry already has the right address and is claimed in place,
  // never stacked on. History state survives a reload, so the entry's
  // own tag can't tell this case apart.
  const openingLink = useRef(false);
  // Once per mount (run is stable). Deliberately not guarded by a ref:
  // a remount (React's dev double-mount does one) aborts the analysis
  // this started, and only running it again recovers from that.
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
        // Same as opening a link: the cached report, or an offer to run it.
        openingLink.current = true;
        run(site, { cachedOnly: true });
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [hasReport, analyzedUrl, run, setStage]);
}

/** The in-app "back to report": a real history step when the contact step was pushed as one. */
export function backToReport(setStage: (stage: Stage) => void) {
  if (window.history.state?.stage === "next-step") window.history.back();
  else setStage("report");
}
