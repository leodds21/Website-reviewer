// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAnalysis } from "./useAnalysis";
import { SCAN_STEPS } from "@/lib/scanSteps";

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function streamResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return { ok: true, status: 200, body } as unknown as Response;
}

function errorResponse(status: number, jsonBody?: unknown): Response {
  return {
    ok: false,
    status,
    json: async () => {
      if (jsonBody === undefined) throw new Error("not json");
      return jsonBody;
    },
  } as unknown as Response;
}

describe("useAnalysis", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useAnalysis());

    expect(result.current.stage).toBe("idle");
    expect(result.current.report).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("moves to analyzing as soon as the request starts", () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useAnalysis());

    act(() => {
      void result.current.startAnalysis("example.com");
    });

    expect(result.current.stage).toBe("analyzing");
  });

  it("collects steps in the order they arrive", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      streamResponse([sseFrame("step", { step: "pagespeed" }), sseFrame("step", { step: "https" }), sseFrame("failed", { code: "unknown" })]),
    );
    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.startAnalysis("example.com");
    });

    expect(result.current.completedSteps).toEqual(["pagespeed", "https"]);
  });

  it("shows every step done, then moves to report once 'done' arrives", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      streamResponse([sseFrame("step", { step: "https" }), sseFrame("done", { overall: 80 })]),
    );
    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.startAnalysis("example.com");
    });

    expect(result.current.stage).toBe("report");
    expect(result.current.completedSteps).toEqual([...SCAN_STEPS]);
    expect(result.current.report).toEqual({ overall: 80 });
  });

  it("does not record the same step twice if the server repeats it", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      streamResponse([sseFrame("step", { step: "https" }), sseFrame("step", { step: "https" }), sseFrame("failed", { code: "unknown" })]),
    );
    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.startAnalysis("example.com");
    });

    expect(result.current.completedSteps).toEqual(["https"]);
  });

  it("surfaces a 'failed' SSE event as an error and returns to idle", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(streamResponse([sseFrame("failed", { code: "analysis-failed" })]));
    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.startAnalysis("example.com");
    });

    expect(result.current.stage).toBe("idle");
    expect(result.current.error).toEqual({ code: "analysis-failed" });
  });

  it("reports unknown when the stream ends without a done or failed event", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(streamResponse([sseFrame("step", { step: "https" })]));
    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.startAnalysis("example.com");
    });

    expect(result.current.stage).toBe("idle");
    expect(result.current.error).toEqual({ code: "unknown" });
  });

  it("reports offline without calling fetch, when the browser is already offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.startAnalysis("example.com");
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.stage).toBe("idle");
    expect(result.current.error).toEqual({ code: "offline" });
  });

  it("reads the error code straight off a non-ok JSON response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse(400, { code: "invalid-url" }));
    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.startAnalysis("not a url");
    });

    expect(result.current.error).toEqual({ code: "invalid-url" });
  });

  it("falls back to rate-limited for a 429 whose body isn't JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse(429));
    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.startAnalysis("example.com");
    });

    expect(result.current.error).toEqual({ code: "rate-limited" });
  });

  it("classifies a network failure as offline when the browser has gone offline", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => {
      vi.stubGlobal("navigator", { onLine: false });
      return Promise.reject(new TypeError("Failed to fetch"));
    });
    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.startAnalysis("example.com");
    });

    expect(result.current.error).toEqual({ code: "offline" });
  });

  it("classifies a network failure as unknown when still online", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.startAnalysis("example.com");
    });

    expect(result.current.error).toEqual({ code: "unknown" });
  });

  it("aborts the in-flight request when a new analysis starts before it finished", async () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {})); // never resolves
    vi.mocked(fetch).mockResolvedValueOnce(streamResponse([sseFrame("done", {})]));
    const { result } = renderHook(() => useAnalysis());

    act(() => {
      void result.current.startAnalysis("first.com");
    });
    const firstSignal = vi.mocked(fetch).mock.calls[0][1]?.signal as AbortSignal;

    await act(async () => {
      await result.current.startAnalysis("second.com");
    });

    expect(firstSignal.aborted).toBe(true);
  });

  it("aborts an in-flight request when the component unmounts", () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {})); // never resolves
    const { result, unmount } = renderHook(() => useAnalysis());

    act(() => {
      void result.current.startAnalysis("example.com");
    });
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });
});

describe("useAnalysis, progressive report", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // A stream the test feeds frame by frame.
  function liveStream() {
    const encoder = new TextEncoder();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start: (c) => (controller = c) });
    return {
      response: { ok: true, status: 200, body } as unknown as Response,
      send: (event: string, data: unknown) => controller.enqueue(encoder.encode(sseFrame(event, data))),
      close: () => controller.close(),
    };
  }

  it("opens the report on the partial one, then swaps in the final report without changing screen", async () => {
    const stream = liveStream();
    vi.mocked(fetch).mockResolvedValueOnce(stream.response);
    const { result } = renderHook(() => useAnalysis());

    let run!: Promise<void>;
    act(() => {
      run = result.current.startAnalysis("example.com");
    });
    await act(async () => stream.send("partial", { domain: "example.com", inProgress: true }));
    await vi.waitFor(() => expect(result.current.stage).toBe("report"));
    expect(result.current.report).toEqual({ domain: "example.com", inProgress: true });

    act(() => result.current.setStage("next-step"));
    await act(async () => {
      stream.send("done", { domain: "example.com" });
      stream.close();
      await run;
    });

    expect(result.current.report).toEqual({ domain: "example.com" });
    expect(result.current.stage).toBe("next-step");
    expect(result.current.unfinished).toBe(false);
  });

  it("keeps the partial report when the stream drops before Google's measurement", async () => {
    const stream = liveStream();
    vi.mocked(fetch).mockResolvedValueOnce(stream.response);
    const { result } = renderHook(() => useAnalysis());

    let run!: Promise<void>;
    act(() => {
      run = result.current.startAnalysis("example.com");
    });
    await act(async () => {
      stream.send("partial", { domain: "example.com", inProgress: true });
      stream.close();
      await run;
    });

    expect(result.current.stage).toBe("report");
    expect(result.current.error).toBeNull();
    expect(result.current.unfinished).toBe(true);
  });
});
