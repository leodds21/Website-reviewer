import { useEffect, useRef, useState } from "react";
import type { StepKey } from "@/app/components/LoadingSequence";
import type { AnalyzeReport } from "@/lib/report";

export type Stage = "idle" | "analyzing" | "report" | "next-step";

export function useAnalysis(errorGeneric: string) {
  const [stage, setStage] = useState<Stage>("idle");
  const [completedSteps, setCompletedSteps] = useState<StepKey[]>([]);
  const [report, setReport] = useState<AnalyzeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  // Closes any analysis still in flight if the component unmounts
  // (e.g. navigating away mid-scan) — otherwise the EventSource keeps
  // its connection open and its listeners keep firing into state
  // setters on an unmounted component.
  useEffect(() => {
    return () => {
      sourceRef.current?.close();
    };
  }, []);

  function startAnalysis(url: string) {
    sourceRef.current?.close();
    setStage("analyzing");
    setCompletedSteps([]);
    setError(null);
    setReport(null);

    const source = new EventSource(`/api/analyze?url=${encodeURIComponent(url)}`);
    sourceRef.current = source;

    source.addEventListener("step", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { step: StepKey };
      setCompletedSteps((prev) => [...prev, data.step]);
    });

    source.addEventListener("done", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as AnalyzeReport;
      setReport(data);
      setStage("report");
      source.close();
    });

    // Named "failed" (not "error") specifically to avoid colliding
    // with EventSource's own connection-level "error" event, which
    // fires with no `data` at all — that native case is handled by
    // the fallback below rather than confused with a real analysis
    // failure the server reported on purpose.
    source.addEventListener("failed", (event) => {
      // The server sends its failure reason in Portuguese regardless of
      // UI language (it's produced deep in the check/PageSpeed layer,
      // not worth threading a locale through the whole backend for a
      // rare error path) — a native connection-level error has no
      // `data` at all, so that case falls back to the localized string.
      const raw = (event as MessageEvent).data;
      const message = raw ? (JSON.parse(raw) as { error: string }).error : errorGeneric;
      setError(message);
      setStage("idle");
      source.close();
    });

    source.addEventListener("error", () => {
      if (source.readyState === EventSource.CLOSED) return;
      setError(errorGeneric);
      setStage("idle");
      source.close();
    });
  }

  return { stage, setStage, completedSteps, report, error, startAnalysis };
}
