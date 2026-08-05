import { useEffect, useRef, useState } from "react";

type ContactStatus = "idle" | "submitting" | "just-succeeded" | "succeeded" | "error";

export function useContactForm(options: {
  domain: string | undefined;
  formNotConfigured: string;
  sendError: string;
}) {
  const [contact, setContact] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<ContactStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  async function submitContact(event: React.FormEvent) {
    event.preventDefault();
    const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;
    if (!endpoint) {
      setStatus("error");
      setErrorMessage(options.formNotConfigured);
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: contact.name,
          email: contact.email,
          message: contact.message,
          _subject: `Isdias.dev: novo contato sobre ${options.domain}`,
          site: options.domain,
        }),
      });

      if (response.ok) {
        // Holds the button in its "check" state for a beat before
        // swapping to the confirmation message — an instant swap reads
        // as the click didn't register, not as success.
        setStatus("just-succeeded");
        successTimerRef.current = setTimeout(() => setStatus("succeeded"), 1200);
        return;
      }

      setStatus("error");
      setErrorMessage(options.sendError);
    } catch {
      setStatus("error");
      setErrorMessage(options.sendError);
    }
  }

  return {
    contact,
    setContact,
    submitting: status === "submitting",
    justSucceeded: status === "just-succeeded",
    succeeded: status === "succeeded",
    errorMessage: status === "error" ? errorMessage : null,
    submitContact,
  };
}
