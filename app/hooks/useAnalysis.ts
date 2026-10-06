import { useCallback, useEffect, useRef, useState } from "react";
import type { StepKey } from "@/lib/scanSteps";
import type { AnalyzeReport } from "@/lib/report";
import type { AnalyzeError } from "@/lib/analyzeError";
import { createSseParser } from "@/lib/sse";

export type Stage = "idle" | "analyzing" | "report" | "next-step";

// A ceiling on the whole analysis, well past the server's own per-check
// timeouts (8s each, 30s for PageSpeed). It exists for the case those
// never fire — a connection that stays open but stops delivering — so
// the loading screen can't spin forever with no way out.
const OVERALL_TIMEOUT_MS = 90_000;

export function useAnalysis() {
  const [stage, setStage] = useState<Stage>("idle");
  const [completedSteps, setCompletedSteps] = useState<StepKey[]>([]);
  const [report, setReport] = useState<AnalyzeReport | null>(null);
  const [error, setError] = useState<AnalyzeError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Aborts an analysis still in flight when the component goes away, so
  // the request stops server-side instead of running to completion for
  // nobody (and so no state setter fires after unmount).
  useEffect(() => () => abortRef.current?.abort(), []);

  const startAnalysis = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStage("analyzing");
    setCompletedSteps([]);
    setError(null);
    setReport(null);

    // Checked before the request rather than after it fails: "você está
    // sem conexão" is a much more useful thing to read than a generic
    // failure, and it's the one failure the visitor can actually act on.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError({ code: "offline" });
      setStage("idle");
      return;
    }

    const timeout = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), OVERALL_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`, {
        signal: controller.signal,
        headers: { Accept: "text/event-stream" },
      });

      // fetch (unlike EventSource, which can only ever report "it
      // failed") gives us the status and the body — so a rate limit or
      // a rejected URL can say what actually happened, with the wait
      // time, instead of collapsing into one generic message.
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
            setReport(JSON.parse(event.data) as AnalyzeReport);
            setStage("report");
            finished = true;
          } else if (event.event === "failed") {
            setError(JSON.parse(event.data) as AnalyzeError);
            setStage("idle");
            finished = true;
          }
        }
      }

      // The stream ended without ever saying how it went — a dropped
      // connection mid-analysis. Silently returning to the idle screen
      // with no explanation is the one thing that mustn't happen.
      if (!finished) {
        setError({ code: "unknown" });
        setStage("idle");
      }
    } catch (caught) {
      // An abort from starting a new analysis (or unmounting) is us,
      // not a failure — leave the state to whatever replaced it.
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
    // Non-JSON body (a proxy's own error page, say) — fall through.
  }
  return response.status === 429 ? { code: "rate-limited" } : { code: "unknown" };
}

function classifyFailure(caught: unknown): AnalyzeError["code"] {
  if ((caught as DOMException)?.name === "TimeoutError") return "timeout";
  // fetch rejects with a TypeError for anything network-level: DNS
  // failure, connection refused, the machine going offline mid-request.
  if (caught instanceof TypeError) {
    return typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "unknown";
  }
  return "unknown";
}
