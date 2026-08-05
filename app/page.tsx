"use client";

import { useState } from "react";
import { LoadingSequence } from "./components/LoadingSequence";
import { IdleScreen } from "./components/IdleScreen";
import { ReportScreen } from "./components/ReportScreen";
import { NextStepScreen } from "./components/NextStepScreen";
import { useAnalysis } from "./hooks/useAnalysis";

export default function Home() {
  const [url, setUrl] = useState("");
  const { stage, setStage, completedSteps, report, error, startAnalysis } = useAnalysis();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startAnalysis(url);
  }

  const topIssues = report
    ? [...report.issues]
        .sort((a, b) => Number(a.severity !== "critico") - Number(b.severity !== "critico"))
        .slice(0, 2)
    : [];

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-md">
        {stage === "idle" && <IdleScreen url={url} onUrlChange={setUrl} onSubmit={handleSubmit} error={error} />}

        {stage === "analyzing" && <LoadingSequence completedSteps={completedSteps} />}

        {stage === "report" && report && <ReportScreen report={report} onNextStep={() => setStage("next-step")} />}

        {stage === "next-step" && report && <NextStepScreen report={report} topIssues={topIssues} />}
      </div>
    </main>
  );
}
