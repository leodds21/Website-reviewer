import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { SCAN_STEPS, type StepKey } from "@/lib/scanSteps";
import type { AnalyzeReport } from "@/lib/report";
import type { AnalyzeError } from "@/lib/analyzeError";
import { createSseParser } from "@/lib/sse";
import { parseAnalysisEvent } from "@/lib/analysisEvents";

export type Stage = "idle" | "analyzing" | "report" | "next-step";

// For a connection that stays open but stops delivering.
const OVERALL_TIMEOUT_MS = 90_000;

// Lets the bar visibly reach 100% before the report replaces it.
const FINISH_HOLD_MS = 700;

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(id);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

// initialReport: a shared report the server already rendered.
export function useAnalysis(initialReport: AnalyzeReport | null = null) {
  const [stage, setStage] = useState<Stage>(initialReport ? "report" : "idle");
  const [completedSteps, setCompletedSteps] = useState<StepKey[]>([]);
  const [report, setReport] = useState<AnalyzeReport | null>(initialReport);
  const [error, setError] = useState<AnalyzeError | null>(null);
  // The partial report stays up when Google's measurement never arrives.
  const [unfinished, setUnfinished] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const startAnalysis = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStage("analyzing");
    setCompletedSteps([]);
    setError(null);
    setReport(null);
    setUnfinished(false);

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError({ code: "offline" });
      setStage("idle");
      return;
    }

    const timeout = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), OVERALL_TIMEOUT_MS);
    let shownPartial = false;

    try {
      const response = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`, {
        signal: controller.signal,
        headers: { Accept: "text/event-stream" },
      });

      // fetch, not EventSource, so error status and body are readable.
      if (!response.ok) {
        setError(await readErrorBody(response));
        setStage("idle");
        return;
      }

      if (!response.body) {
        setError({ code: "unknown" });
        setStage("idle");
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      const parser = createSseParser();
      let finished = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const frame of parser.push(value)) {
          const event = parseAnalysisEvent(frame);
          if (!event) continue;
          if (event.event === "step") {
            const { step } = event.data;
            setCompletedSteps((previous) => (previous.includes(step) ? previous : [...previous, step]));
          } else if (event.event === "partial") {
            shownPartial = true;
            const partial = event.data;
            // Screen changes run as transitions, which is what animates them.
            startTransition(() => {
              setReport(partial);
              setStage("report");
            });
          } else if (event.event === "done") {
            finished = true;
            clearTimeout(timeout);
            setCompletedSteps([...SCAN_STEPS]);
            // Already on the report (or the next step): just swap in the final data.
            const final = event.data;
            if (!shownPartial) {
              await pause(FINISH_HOLD_MS, controller.signal);
              if (controller.signal.aborted) return;
            }
            startTransition(() => {
              setReport(final);
              if (!shownPartial) setStage("report");
            });
          } else if (event.event === "failed") {
            finished = true;
            if (shownPartial) setUnfinished(true);
            else {
              setError(event.data);
              setStage("idle");
            }
          }
        }
      }

      // The connection dropped mid-analysis.
      if (!finished) {
        if (shownPartial) setUnfinished(true);
        else {
          setError({ code: "unknown" });
          setStage("idle");
        }
      }
    } catch (caught) {
      // A new analysis or unmount aborted this one: not a failure.
      if (controller.signal.aborted && (caught as DOMException)?.name !== "TimeoutError") return;

      if (shownPartial) {
        setUnfinished(true);
        return;
      }
      setError({ code: classifyFailure(caught) });
      setStage("idle");
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  // Callers change screens through transitions too, so every change can animate.
  const changeStage = useCallback((next: Stage) => startTransition(() => setStage(next)), []);

  return { stage, setStage: changeStage, completedSteps, report, error, unfinished, startAnalysis };
}

async function readErrorBody(response: Response): Promise<AnalyzeError> {
  try {
    const body = (await response.json()) as Partial<AnalyzeError>;
    if (body?.code) return body as AnalyzeError;
  } catch {
    // Not JSON, e.g. a proxy's error page.
  }
  return response.status === 429 ? { code: "rate-limited" } : { code: "unknown" };
}

function classifyFailure(caught: unknown): AnalyzeError["code"] {
  if ((caught as DOMException)?.name === "TimeoutError") return "timeout";
  if (caught instanceof TypeError) {
    return typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "unknown";
  }
  return "unknown";
}
