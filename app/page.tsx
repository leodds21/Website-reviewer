"use client";

import { useState } from "react";
import { LoadingSequence } from "./components/LoadingSequence";
import { IdleScreen } from "./components/IdleScreen";
import { ReportScreen } from "./components/ReportScreen";
import { NextStepScreen } from "./components/NextStepScreen";
import { useAnalysis } from "./hooks/useAnalysis";
import { useStageFocus } from "./hooks/useStageFocus";
import { prioritizeIssues } from "@/lib/issues";

export default function Home() {
  const [url, setUrl] = useState("");
  // Which way the visitor reached the last screen: "see how to fix it"
  // after a normal report, or "request a manual review" after a site
  // that blocked the automated checks.
  const [manualReview, setManualReview] = useState(false);
  const { stage, setStage, completedSteps, report, error, startAnalysis } = useAnalysis();
  const stageRef = useStageFocus<HTMLDivElement>(stage);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startAnalysis(url);
  }

  const topIssues = report ? prioritizeIssues(report.issues).slice(0, 2) : [];

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      {/* tabIndex -1 makes this focusable programmatically but not in
          the Tab order, so the focus move on stage change doesn't add a
          stop keyboard users have to pass through afterwards. */}
      <div ref={stageRef} tabIndex={-1} className="w-full max-w-md focus:outline-none">
        {stage === "idle" && <IdleScreen url={url} onUrlChange={setUrl} onSubmit={handleSubmit} error={error} />}

        {stage === "analyzing" && <LoadingSequence completedSteps={completedSteps} />}

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
          />
        )}

        {stage === "next-step" && report && (
          <NextStepScreen report={report} topIssues={topIssues} manualReview={manualReview} />
        )}
      </div>
    </main>
  );
}
