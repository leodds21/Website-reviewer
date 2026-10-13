import { describe, expect, it } from "vitest";
import { parseAnalysisEvent, sseFrame } from "./analysisEvents";
import { createSseParser } from "./sse";

describe("analysis events", () => {
  it("round-trips every event through the SSE parser", () => {
    const frames =
      sseFrame({ event: "step", data: { step: "https" } }) +
      sseFrame({ event: "failed", data: { code: "timeout" } });
    const events = createSseParser().push(frames).map(parseAnalysisEvent);

    expect(events).toEqual([
      { event: "step", data: { step: "https" } },
      { event: "failed", data: { code: "timeout" } },
    ]);
  });

  it("ignores events it doesn't know", () => {
    expect(parseAnalysisEvent({ event: "ping", data: "{}" })).toBeNull();
  });
});
