import type { AnalyzeReport } from "./report";
import type { AnalyzeError } from "./analyzeError";
import type { StepKey } from "./scanSteps";
import type { SseEvent } from "./sse";

/**
 * The analyze stream: `step` per finished check, at most one `partial`
 * report (our own checks done, Google still running), then `done` or `failed`.
 * After a `partial`, the stream always ends in `done`.
 */
export type AnalysisEvent =
  | { event: "step"; data: { step: StepKey } }
  | { event: "partial"; data: AnalyzeReport }
  | { event: "done"; data: AnalyzeReport }
  | { event: "failed"; data: AnalyzeError };

export function sseFrame({ event, data }: AnalysisEvent): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const EVENTS = new Set<AnalysisEvent["event"]>(["step", "partial", "done", "failed"]);

export function parseAnalysisEvent({ event, data }: SseEvent): AnalysisEvent | null {
  if (!EVENTS.has(event as AnalysisEvent["event"])) return null;
  return { event, data: JSON.parse(data) } as AnalysisEvent;
}
