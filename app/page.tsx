"use client";

import { useEffect, useState } from "react";
import { HomeScreen } from "./components/HomeScreen";
import { ReportScreen } from "./components/ReportScreen";
import { NextStepScreen } from "./components/NextStepScreen";
import { useAnalysis } from "./hooks/useAnalysis";
import { useStageFocus } from "./hooks/useStageFocus";
import { prioritizeIssues } from "@/lib/issues";
import { useLanguage } from "./i18n/LanguageContext";

export default function Home() {
  const [url, setUrl] = useState("");
  // Which way the visitor reached the last screen: "see how to fix it"
  // after a normal report, or "request a manual review" after a site
  // that blocked the automated checks.
  const [manualReview, setManualReview] = useState(false);
  const { stage, setStage, completedSteps, report, error, startAnalysis } = useAnalysis();
  const stageRef = useStageFocus<HTMLDivElement>(stage);
  const { t } = useLanguage();

  // With a report open the tab says which site and how it did, so
  // several analyses in different tabs can be told apart at a glance.
  const showsReport = stage !== "idle" && stage !== "analyzing" && report !== null;
  useEffect(() => {
    if (!showsReport || !report) {
      document.title = t.documentTitle;
      return;
    }
    const { overall, overallSeverity } = report.score;
    const prefix = overallSeverity === "indisponivel" ? report.domain : `${overall} · ${report.domain}`;
    document.title = `${prefix} | ${t.documentTitle}`;
  }, [showsReport, report, t.documentTitle]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startAnalysis(url);
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

      {stage === "report" && report && (
        <ReportScreen
          report={report}
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
      )}

      {stage === "next-step" && report && (
        <NextStepScreen report={report} topIssues={topIssues} manualReview={manualReview} onBack={() => setStage("report")} />
      )}
    </div>
  );
}
