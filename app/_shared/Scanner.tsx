"use client";

import { Activity, Suspense, ViewTransition, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { HomeScreen } from "../components/HomeScreen";
import { useAnalysis } from "../hooks/useAnalysis";
import { useStageFocus } from "../hooks/useStageFocus";
import { backToReport, useReportLink } from "../hooks/useReportLink";
import { topIssues } from "@/lib/issues";
import type { AnalyzeReport } from "@/lib/report";
import { useLanguage } from "../i18n/LanguageContext";

// Only needed once a report exists, so not in the home page's first load.
// Starting an analysis fetches them while the checks run (same promise as dynamic()).
const loadReportScreen = () => import("../components/ReportScreen");
const loadNextStepScreen = () => import("../components/NextStepScreen");
const LazyReportScreen = dynamic(() => loadReportScreen().then((module) => module.ReportScreen));
const LazyNextStepScreen = dynamic(() => loadNextStepScreen().then((module) => module.NextStepScreen));

export type ReportScreens = {
  ReportScreen: React.ComponentType<React.ComponentProps<typeof LazyReportScreen>>;
  NextStepScreen: React.ComponentType<React.ComponentProps<typeof LazyNextStepScreen>>;
};

const LAZY_SCREENS: ReportScreens = { ReportScreen: LazyReportScreen, NextStepScreen: LazyNextStepScreen };

function preloadReportScreens() {
  void loadReportScreen();
  void loadNextStepScreen();
}

// The interactive part of every page: form, progress, report and next step.
// A shared report page passes the screens in directly: it needs them on first paint.
export function Scanner({ initialReport = null, screens = LAZY_SCREENS }: { initialReport?: AnalyzeReport | null; screens?: ReportScreens }) {
  const { ReportScreen, NextStepScreen } = screens;
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
    preloadReportScreens();
    startAnalysis(url);
  }


  return (
    <div ref={stageRef} tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
      {(stage === "idle" || stage === "analyzing") && (
        <ScreenTransition>
          <HomeScreen
            url={url}
            onUrlChange={setUrl}
            onSubmit={handleSubmit}
            error={error ?? (prefilled ? { code: "not-cached" } : null)}
            analyzing={stage === "analyzing"}
            completedSteps={stage === "analyzing" ? completedSteps : []}
          />
        </ScreenTransition>
      )}

      {/* Hidden screens keep their state (typed text, open sections) and pause their effects. */}
      {openReport && (
        <Suspense>
          <Activity mode={stage === "report" ? "visible" : "hidden"}>
            <ScreenTransition>
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
            </ScreenTransition>
          </Activity>
          <Activity mode={stage === "next-step" ? "visible" : "hidden"}>
            <ScreenTransition>
              <NextStepScreen
                report={openReport}
                topIssues={topIssues(openReport.issues, openReport.score)}
                manualReview={manualReview}
                onBack={() => backToReport(setStage)}
              />
            </ScreenTransition>
          </Activity>
        </Suspense>
      )}
    </div>
  );
}

// A screen fades in as the previous one fades out; nothing else animates.
function ScreenTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="screen-in" exit="screen-out" default="none">
      <div className="flex flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}
