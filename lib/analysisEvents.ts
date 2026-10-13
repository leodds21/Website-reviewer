import type { AnalyzeReport } from "./report";
import type { AnalyzeError } from "./analyzeError";
import type { StepKey } from "./scanSteps";
import type { SseEvent } from "./sse";

/**
 * The analyze stream: `step` per finished check, a `partial` report once our
 * own checks are done and Google is still running, then `done` or `failed`.
 * A leading run always ends a `partial` with `done`; a follower can still end
 * in `failed` (its own deadline, a takeover refused by the rate limit), and a
 * takeover sends its steps and `partial` again.
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
