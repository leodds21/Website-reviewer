import { useCallback, useEffect, useRef, useState } from "react";
import { SCAN_STEPS, type StepKey } from "@/lib/scanSteps";
import type { AnalyzeReport } from "@/lib/report";
import type { AnalyzeError } from "@/lib/analyzeError";
import { createSseParser } from "@/lib/sse";

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

export function useAnalysis() {
  const [stage, setStage] = useState<Stage>("idle");
  const [completedSteps, setCompletedSteps] = useState<StepKey[]>([]);
  const [report, setReport] = useState<AnalyzeReport | null>(null);
  const [error, setError] = useState<AnalyzeError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // cachedOnly: for report links, which must never start an analysis.
  const startAnalysis = useCallback(async (url: string, { cachedOnly = false }: { cachedOnly?: boolean } = {}) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStage("analyzing");
    setCompletedSteps([]);
    setError(null);
    setReport(null);

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError({ code: "offline" });
      setStage("idle");
      return;
    }

    const timeout = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), OVERALL_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/analyze?url=${encodeURIComponent(url)}${cachedOnly ? "&cached=only" : ""}`, {
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

        for (const event of parser.push(value)) {
          if (event.event === "step") {
            const { step } = JSON.parse(event.data) as { step: StepKey };
            setCompletedSteps((previous) => (previous.includes(step) ? previous : [...previous, step]));
          } else if (event.event === "done") {
            finished = true;
            const finishedReport = JSON.parse(event.data) as AnalyzeReport;
            clearTimeout(timeout);
            setCompletedSteps([...SCAN_STEPS]);
            await pause(FINISH_HOLD_MS, controller.signal);
            if (controller.signal.aborted) return;
            setReport(finishedReport);
            setStage("report");
          } else if (event.event === "failed") {
            setError(JSON.parse(event.data) as AnalyzeError);
            setStage("idle");
            finished = true;
          }
        }
      }

      // The connection dropped mid-analysis.
      if (!finished) {
        setError({ code: "unknown" });
        setStage("idle");
      }
    } catch (caught) {
      // A new analysis or unmount aborted this one: not a failure.
      if (controller.signal.aborted && (caught as DOMException)?.name !== "TimeoutError") return;

      setError({ code: classifyFailure(caught) });
      setStage("idle");
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  return { stage, setStage, completedSteps, report, error, startAnalysis };
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
