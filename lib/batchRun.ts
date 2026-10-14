import { createSseParser } from "./sse";
import { parseAnalysisEvent } from "./analysisEvents";
import type { AnalyzeReport } from "./report";
import type { AnalyzeError } from "./analyzeError";

export type BatchOutcome = { ok: true; report: AnalyzeReport } | { ok: false; error: AnalyzeError };

// Same as the single analysis: a connection that stays open but stops delivering.
const ITEM_TIMEOUT_MS = 90_000;

/** One analysis through the same endpoint, read to its final report. */
export async function analyzeForBatch(url: string, token: string, signal: AbortSignal): Promise<BatchOutcome> {
  const itemSignal = AbortSignal.any([signal, AbortSignal.timeout(ITEM_TIMEOUT_MS)]);
  let partial: AnalyzeReport | null = null;
  try {
    const response = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`, {
      signal: itemSignal,
      headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as Partial<AnalyzeError> | null;
      return { ok: false, error: body?.code ? (body as AnalyzeError) : { code: "unknown" } };
    }
    if (!response.body) return { ok: false, error: { code: "unknown" } };

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    const parser = createSseParser();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const frame of parser.push(value)) {
        const event = parseAnalysisEvent(frame);
        if (event?.event === "done") return { ok: true, report: event.data };
        if (event?.event === "failed") return partial ? { ok: true, report: partial } : { ok: false, error: event.data };
        if (event?.event === "partial") partial = event.data;
      }
    }
  } catch (caught) {
    if (signal.aborted) throw caught;
    if (!partial) return { ok: false, error: { code: (caught as DOMException)?.name === "TimeoutError" ? "timeout" : "unknown" } };
  }
  // Google's measurement never came: the partial report is still worth a row.
  return partial ? { ok: true, report: partial } : { ok: false, error: { code: "unknown" } };
}

/** Runs `worker` over `items`, at most `concurrency` at a time, in order. */
export async function runPool<T>(items: readonly T[], concurrency: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
}
