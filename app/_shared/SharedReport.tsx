"use client";

import { ReportScreen } from "../components/ReportScreen";
import { NextStepScreen } from "../components/NextStepScreen";
import { Scanner } from "./Scanner";
import type { AnalyzeReport } from "@/lib/report";

// Imported directly, not on demand: the report is the first thing this page shows.
const SCREENS = { ReportScreen, NextStepScreen };

export function SharedReport({ report }: { report: AnalyzeReport }) {
  return <Scanner initialReport={report} screens={SCREENS} />;
}
