"use client";

import { useCallback, useEffect, useState } from "react";
import { HomeScreen } from "./components/HomeScreen";
import { ReportScreen } from "./components/ReportScreen";
import { NextStepScreen } from "./components/NextStepScreen";
import { useAnalysis } from "./hooks/useAnalysis";
import { useStageFocus } from "./hooks/useStageFocus";
import { backToReport, useReportLink } from "./hooks/useReportLink";
import { prioritizeIssues } from "@/lib/issues";
import { useLanguage } from "./i18n/LanguageContext";

export default function Home() {
  const [url, setUrl] = useState("");
  // Which way the visitor reached the last screen: "see how to fix it"
  // after a normal report, or "request a manual review" after a site
  // that blocked the automated checks.
  const [manualReview, setManualReview] = useState(false);
  const { stage, setStage, completedSteps, report, error, startAnalysis } = useAnalysis();
  // Idle and analyzing are one screen (the plan turns into progress in
  // place), so starting an analysis isn't a screen change: moving focus
  // there scrolled the page back to the top, undoing HomeScreen's scroll
  // to the plan on phones.
  const stageRef = useStageFocus<HTMLDivElement>(stage === "analyzing" ? "idle" : stage);
  const { t } = useLanguage();
  // What the report on screen was run for, as typed: the ?url= value.
  const [analyzedUrl, setAnalyzedUrl] = useState("");

  const run = useCallback(
    (site: string) => {
      setUrl(site);
      setAnalyzedUrl(site.trim());
      startAnalysis(site);
    },
    [startAnalysis],
  );
  useReportLink({ stage, setStage, analyzedUrl, hasReport: report !== null, run });

  // The report and the contact step that follows it.
  const openReport = stage === "report" || stage === "next-step" ? report : null;

  // With a report open the tab says which site and how it did, so
  // several analyses in different tabs can be told apart at a glance.
  useEffect(() => {
    if (!openReport) {
      document.title = t.documentTitle;
      return;
    }
    const { overall, overallSeverity } = openReport.score;
    const prefix = overallSeverity === "indisponivel" ? openReport.domain : `${overall} · ${openReport.domain}`;
    document.title = `${prefix} | ${t.documentTitle}`;
  }, [openReport, t.documentTitle]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(url);
  }

  const topIssues = report ? prioritizeIssues(report.issues).slice(0, 2) : [];

  return (
    // tabIndex -1 makes this focusable programmatically but not in the
    // Tab order, so the focus move on stage change doesn't add a stop
    // keyboard users have to pass through afterwards.
    <div ref={stageRef} tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
      {(stage === "idle" || stage === "analyzing") && (
        <HomeScreen
          url={url}
          onUrlChange={setUrl}
          onSubmit={handleSubmit}
          error={error}
          analyzing={stage === "analyzing"}
          // Only a run in progress has steps to show: after "Nova análise"
          // or a failed run, the plan starts over instead of showing the
          // previous analysis as done.
          completedSteps={stage === "analyzing" ? completedSteps : []}
        />
      )}

      {/* Both stay mounted while a report is open, one of them hidden:
          going back to the report and returning keeps what was typed in
          the contact form (or its "sent" confirmation), and the report
          keeps the sections the visitor opened. A new analysis unmounts
          both, so nothing carries over to another site. */}
      {openReport && (
        <>
          <div hidden={stage !== "report"} className="flex flex-1 flex-col">
            <ReportScreen
              report={openReport}
              onNextStep={() => {
                setManualReview(false);
                setStage("next-step");
              }}
              onManualAnalysis={() => {
                setManualReview(true);
                setStage("next-step");
              }}
              onNewAnalysis={() => setStage("idle")}
            />
          </div>
          <div hidden={stage !== "next-step"} className="flex flex-1 flex-col">
            <NextStepScreen report={openReport} topIssues={topIssues} manualReview={manualReview} onBack={() => backToReport(setStage)} />
          </div>
        </>
      )}
    </div>
  );
}
