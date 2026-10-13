"use client";

import { useCallback, useEffect, useState } from "react";
import { HomeScreen } from "../components/HomeScreen";
import { ReportScreen } from "../components/ReportScreen";
import { NextStepScreen } from "../components/NextStepScreen";
import { useAnalysis } from "../hooks/useAnalysis";
import { useStageFocus } from "../hooks/useStageFocus";
import { backToReport, useReportLink } from "../hooks/useReportLink";
import { topIssues } from "@/lib/issues";
import type { AnalyzeReport } from "@/lib/report";
import { useLanguage } from "../i18n/LanguageContext";

// The interactive part of every page: form, progress, report and next step.
export function Scanner({ initialReport = null }: { initialReport?: AnalyzeReport | null }) {
  const [url, setUrl] = useState("");
  const [manualReview, setManualReview] = useState(false);
  // An old ?url= link or an expired report: the field comes filled, nothing runs on its own.
  const [prefilled, setPrefilled] = useState(false);
  const { stage, setStage, completedSteps, report, error, unfinished, startAnalysis } = useAnalysis(initialReport);
  // Idle and analyzing are one screen; moving focus would undo the scroll on phones.
  const stageRef = useStageFocus<HTMLDivElement>(stage === "analyzing" ? "idle" : stage);
  const { locale, t } = useLanguage();

  const prefill = useCallback((site: string) => {
    setUrl(site);
    setPrefilled(true);
  }, []);
  useReportLink({ locale, stage, setStage, report, onPrefill: prefill });

  const openReport = stage === "report" || stage === "next-step" ? report : null;

  useEffect(() => {
    if (!openReport) {
      document.title = t.documentTitle;
      return;
    }
    const { overall, overallSeverity } = openReport.score;
    const prefix =
      overallSeverity === "indisponivel" || overallSeverity === "pendente" ? openReport.domain : `${overall} · ${openReport.domain}`;
    document.title = `${prefix} | ${t.documentTitle}`;
  }, [openReport, t.documentTitle]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPrefilled(false);
    startAnalysis(url);
  }


  return (
    <div ref={stageRef} tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
      {(stage === "idle" || stage === "analyzing") && (
        <HomeScreen
          url={url}
          onUrlChange={setUrl}
          onSubmit={handleSubmit}
          error={error ?? (prefilled ? { code: "not-cached" } : null)}
          analyzing={stage === "analyzing"}
          completedSteps={stage === "analyzing" ? completedSteps : []}
        />
      )}

      {/* Both stay mounted so switching back keeps the form and open sections. */}
      {openReport && (
        <>
          <div hidden={stage !== "report"} className="flex flex-1 flex-col">
            <ReportScreen
              report={openReport}
              unfinished={unfinished}
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
            <NextStepScreen report={openReport} topIssues={topIssues(openReport.issues, openReport.score)} manualReview={manualReview} onBack={() => backToReport(setStage)} />
          </div>
        </>
      )}
    </div>
  );
}
