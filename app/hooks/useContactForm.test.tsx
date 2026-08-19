// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContactForm } from "./useContactForm";

function submitEvent(): FormEvent {
  return { preventDefault: vi.fn() } as unknown as FormEvent;
}

function fakeResponse(ok: boolean, status = ok ? 200 : 400): Response {
  return { ok, status } as Response;
}

describe("useContactForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubEnv("NEXT_PUBLIC_FORMSPREE_ENDPOINT", "https://formspree.io/f/test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("starts idle with an empty contact form", () => {
    const { result } = renderHook(() => useContactForm({ domain: "example.com" }));

    expect(result.current.contact).toEqual({ name: "", email: "", message: "" });
    expect(result.current.submitting).toBe(false);
    expect(result.current.errorCode).toBeNull();
  });

  it("fails with not-configured, without calling fetch, when the Formspree endpoint isn't set", async () => {
    vi.stubEnv("NEXT_PUBLIC_FORMSPREE_ENDPOINT", "");
    const { result } = renderHook(() => useContactForm({ domain: "example.com" }));

    await act(async () => {
      await result.current.submitContact(submitEvent());
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.errorCode).toBe("not-configured");
  });

  it("fails with offline, without calling fetch, when the browser is already offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { result } = renderHook(() => useContactForm({ domain: "example.com" }));

    await act(async () => {
      await result.current.submitContact(submitEvent());
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.errorCode).toBe("offline");
  });

  it("moves to just-succeeded right after a successful response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(true));
    const { result } = renderHook(() => useContactForm({ domain: "example.com" }));

    await act(async () => {
      await result.current.submitContact(submitEvent());
    });

    expect(result.current.justSucceeded).toBe(true);
    expect(result.current.succeeded).toBe(false);
    expect(result.current.errorCode).toBeNull();
  });

  it("settles into succeeded after the hold delay passes", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(true));
    const { result } = renderHook(() => useContactForm({ domain: "example.com" }));

    await act(async () => {
      await result.current.submitContact(submitEvent());
    });
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(result.current.succeeded).toBe(true);
    vi.useRealTimers();
  });

  it("reports rejected when Formspree responds with a non-ok status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(false, 422));
    const { result } = renderHook(() => useContactForm({ domain: "example.com" }));

    await act(async () => {
      await result.current.submitContact(submitEvent());
    });

    expect(result.current.errorCode).toBe("rejected");
    expect(result.current.submitting).toBe(false);
  });

  it("sends the analyzed domain in the request body, for the email subject", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(true));
    const { result } = renderHook(() => useContactForm({ domain: "example.com" }));

    await act(async () => {
      await result.current.submitContact(submitEvent());
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string) as { site: string; _subject: string };
    expect(body.site).toBe("example.com");
    expect(body._subject).toContain("example.com");
  });

  it("classifies a network failure as unknown when still online", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useContactForm({ domain: "example.com" }));

    await act(async () => {
      await result.current.submitContact(submitEvent());
    });

    expect(result.current.errorCode).toBe("unknown");
  });
});
