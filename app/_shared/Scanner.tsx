"use client";

import { Activity, Suspense, ViewTransition, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { HomeScreen } from "../components/HomeScreen";
import { useAnalysis } from "../hooks/useAnalysis";
import { useStageFocus } from "../hooks/useStageFocus";
import { backToReport, useReportLink } from "../hooks/useReportLink";
import { topIssues } from "@/lib/issues";
import type { AnalyzeReport } from "@/lib/report";
import type { AnalyzeError } from "@/lib/analyzeError";
import { PageContainer } from "../components/Chrome";
import { useLanguage } from "../i18n/LanguageContext";

// Only needed once a report exists, so not in the home page's first load.
// Starting an analysis fetches them while the checks run (same promise as dynamic()).
const loadReportScreen = () => import("../components/ReportScreen");
const loadNextStepScreen = () => import("../components/NextStepScreen");
const LazyReportScreen = dynamic(() => loadReportScreen().then((module) => module.ReportScreen));
const LazyNextStepScreen = dynamic(() => loadNextStepScreen().then((module) => module.NextStepScreen));

type ReportScreens = {
  ReportScreen: React.ComponentType<React.ComponentProps<typeof LazyReportScreen>>;
  NextStepScreen: React.ComponentType<React.ComponentProps<typeof LazyNextStepScreen>>;
};

const LAZY_SCREENS: ReportScreens = { ReportScreen: LazyReportScreen, NextStepScreen: LazyNextStepScreen };

// One object, so the note's scroll-into-view effect doesn't rerun on every keystroke.
const OLD_LINK_NOTE: AnalyzeError = { code: "not-cached" };

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
  // A ?url= link: the field comes filled, nothing runs on its own. An old
  // link gets a note; one from the portfolio gets the run button focused.
  const [prefill, setPrefill] = useState<"old-link" | "portfolio" | null>(null);
  const { stage, setStage, completedSteps, report, error, unfinished, hadPartial, startAnalysis } = useAnalysis(initialReport);
  // Idle and analyzing are one screen; moving focus would undo the scroll on phones.
  const stageRef = useStageFocus<HTMLDivElement>(stage === "analyzing" ? "idle" : stage);
  const { locale, t } = useLanguage();

  const onPrefill = useCallback((site: string, fromPortfolio: boolean) => {
    setUrl(site);
    setPrefill(fromPortfolio ? "portfolio" : "old-link");
  }, []);
  useReportLink({ locale, stage, setStage, report, onPrefill });

  const openReport = stage === "report" || stage === "next-step" ? report : null;
  // One polite message per milestone. Lives here, mounted from the start, so
  // screen readers announce it instead of ignoring a region inserted with text.
  const liveMessage = !openReport
    ? ""
    : openReport.inProgress
      ? unfinished
        ? t.googleUnfinished
        : t.liveReportPartial
      : hadPartial
        ? t.liveReportDone
        : "";

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
    setPrefill(null);
    preloadReportScreens();
    startAnalysis(url);
  }


  return (
    <div ref={stageRef} tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
      <p role="status" className="sr-only">
        {liveMessage}
      </p>
      {(stage === "idle" || stage === "analyzing") && (
        <ScreenTransition>
          <HomeScreen
            url={url}
            onUrlChange={(value) => {
              setUrl(value);
              setPrefill(null);
            }}
            onSubmit={handleSubmit}
            error={error ?? (prefill === "old-link" ? OLD_LINK_NOTE : null)}
            focusRun={prefill === "portfolio"}
            analyzing={stage === "analyzing"}
            completedSteps={stage === "analyzing" ? completedSteps : []}
          />
        </ScreenTransition>
      )}

      {/* Hidden screens keep their state (typed text, open sections) and pause their effects. */}
      {openReport && (
        <Suspense fallback={<ReportLoading />}>
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

// Shown only if the report's code is still downloading when its data arrives.
function ReportLoading() {
  const { t } = useLanguage();
  return (
    <PageContainer className="flex flex-1 items-center py-16">
      <p role="status" className="font-mono text-sm text-[var(--color-subtle)]">
        {t.loadingReport}
      </p>
    </PageContainer>
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
