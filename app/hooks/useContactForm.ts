import { useCallback, useEffect, useRef, useState } from "react";

type ContactStatus = "idle" | "submitting" | "just-succeeded" | "succeeded" | "error";

/** Same failure vocabulary as the analysis flow, so both read alike. */
export type ContactErrorCode = "offline" | "timeout" | "not-configured" | "rejected" | "unknown";

const SUBMIT_TIMEOUT_MS = 15_000;
const SUCCESS_HOLD_MS = 1200;

export function useContactForm(options: { domain: string | undefined; initialMessage?: string }) {
  const [contact, setContact] = useState({ name: "", email: "", message: options.initialMessage ?? "" });
  const [status, setStatus] = useState<ContactStatus>("idle");
  const [errorCode, setErrorCode] = useState<ContactErrorCode | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const submitContact = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;
      if (!endpoint) {
        setStatus("error");
        setErrorCode("not-configured");
        return;
      }

      // Worth checking up front for the same reason the analysis does:
      // "you're offline" is something the visitor can act on, where a
      // generic failure just leaves them guessing whether their message
      // went anywhere.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setStatus("error");
        setErrorCode("offline");
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = setTimeout(
        () => controller.abort(new DOMException("timeout", "TimeoutError")),
        SUBMIT_TIMEOUT_MS,
      );

      setStatus("submitting");
      setErrorCode(null);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            name: contact.name,
            email: contact.email,
            message: contact.message,
            _subject: `lsdias.dev: novo contato sobre ${options.domain}`,
            site: options.domain,
          }),
        });

        if (response.ok) {
          // Holds the button in its "check" state for a beat before
          // swapping to the confirmation message — an instant swap reads
          // as the click didn't register, not as success.
          setStatus("just-succeeded");
          successTimerRef.current = setTimeout(() => setStatus("succeeded"), SUCCESS_HOLD_MS);
          return;
        }

        setStatus("error");
        setErrorCode("rejected");
      } catch (caught) {
        if ((caught as DOMException)?.name === "TimeoutError") {
          setStatus("error");
          setErrorCode("timeout");
          return;
        }
        // An abort we caused (unmount) shouldn't paint an error over a
        // screen that's going away.
        if (controller.signal.aborted) return;

        setStatus("error");
        setErrorCode(
          caught instanceof TypeError && typeof navigator !== "undefined" && navigator.onLine === false
            ? "offline"
            : "unknown",
        );
      } finally {
        clearTimeout(timeout);
      }
    },
    [contact, options.domain],
  );

  return {
    contact,
    setContact,
    submitting: status === "submitting",
    justSucceeded: status === "just-succeeded",
    succeeded: status === "succeeded",
    errorCode: status === "error" ? errorCode : null,
    submitContact,
  };
}
