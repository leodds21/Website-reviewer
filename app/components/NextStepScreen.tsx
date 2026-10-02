"use client";

import { Loader2, Check } from "lucide-react";
import { Brand, Corners } from "./Chrome";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { synthesizeCriticalImpact, translateIssue, translateRecommendation } from "@/app/i18n/translations";
import { useContactForm } from "@/app/hooks/useContactForm";
import type { AnalyzeReport } from "@/lib/report";
import type { Issue } from "@/lib/issues";

export function NextStepScreen({
  report,
  topIssues,
  manualReview = false,
}: {
  report: AnalyzeReport;
  topIssues: Issue[];
  manualReview?: boolean;
}) {
  const { locale, t } = useLanguage();
  const { contact, setContact, submitting, justSucceeded, succeeded, errorCode, submitContact } = useContactForm({
    domain: report.domain,
    initialMessage: manualReview ? t.manualMessagePrefill(report.domain) : "",
  });

  // One short summary sentence tying the critical findings together —
  // not a repeat of each item's own explanation, which is exactly why
  // it lives here (right before the CTA) instead of inside the
  // recommendations block above. null when there's nothing critical to
  // summarize, e.g. a report with only secondary findings.
  const criticalIssues = report.issues.filter((issue) => issue.severity === "critico");
  const impactSynthesis = synthesizeCriticalImpact(locale, criticalIssues);

  return (
    <div className="blueprint bg-white/60 p-5">
      <Corners />
      <div className="mb-5 flex items-baseline justify-between">
        <Brand />
      </div>

      <div className="mb-2 text-xs font-semibold tracking-[0.12em] text-[var(--color-accent-700)] uppercase">
        {manualReview ? t.manualKicker : t.nextStepKicker}
      </div>
      <h1 className="mb-3 text-[22px] leading-[1.15] tracking-tight">
        {manualReview ? t.manualHeadline : t.nextStepHeadline}
      </h1>
      <p className="mb-4 text-[13px] leading-relaxed text-[var(--color-text)]/80">
        {manualReview ? t.manualBody : t.nextStepBody}
      </p>

      {topIssues.length > 0 && (
        <div className="blueprint mb-4 p-3.5">
          <Corners />
          <h2 className="mb-2.5 text-[11px] font-semibold tracking-[0.1em] text-[var(--color-text)]/70 uppercase">
            {t.recommendationsHeading}
          </h2>
          <div className="flex flex-col gap-3">
            {topIssues.map((issue, index) => (
              <div key={index} className="text-[12.5px]">
                <div className="mb-0.5 font-medium">{translateIssue(locale, issue.code, issue.params).title}</div>
                <p className="text-[var(--color-text)]/70">{translateRecommendation(locale, issue.code)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {impactSynthesis && (
        <p className="mb-4 text-[13px] leading-relaxed text-[var(--color-text)]/80">{impactSynthesis}</p>
      )}

      {succeeded ? (
        // Names the address the reply is going to: the fields are gone
        // at this point, so without it there's no way to notice a typo
        // in the one thing that makes the reply possible.
        <div role="status" className="flex gap-2.5 border-l-[3px] border-[var(--color-severity-ok)] py-0.5 pl-3">
          <div>
            <p className="text-sm font-medium">{t.sendSuccess}</p>
            <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-700)]">{t.sendSuccessDetail(contact.email)}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={submitContact}>
          <h2 className="mb-2.5 text-base font-semibold tracking-tight">{t.contactHeading}</h2>
          <div className="mb-2.5">
            <label htmlFor="contact-name" className="mb-1 block text-xs text-[var(--color-text)]/70">
              {t.nameLabel}
            </label>
            <input
              id="contact-name"
              required
              autoComplete="name"
              className="w-full border border-[var(--color-divider)] bg-white/60 px-2.5 py-2 text-sm outline-none focus-visible:border-[var(--color-accent)]"
              placeholder={t.namePlaceholder}
              value={contact.name}
              onChange={(event) => setContact({ ...contact, name: event.target.value })}
            />
          </div>
          <div className="mb-2.5">
            <label htmlFor="contact-email" className="mb-1 block text-xs text-[var(--color-text)]/70">
              {t.emailLabel}
            </label>
            <input
              id="contact-email"
              required
              type="email"
              autoComplete="email"
              className="w-full border border-[var(--color-divider)] bg-white/60 px-2.5 py-2 text-sm outline-none focus-visible:border-[var(--color-accent)]"
              placeholder={t.emailPlaceholder}
              value={contact.email}
              onChange={(event) => setContact({ ...contact, email: event.target.value })}
            />
          </div>
          <div className="mb-3">
            <label htmlFor="contact-message" className="mb-1 block text-xs text-[var(--color-text)]/70">
              {t.messageLabel}
            </label>
            <textarea
              id="contact-message"
              required
              rows={3}
              className="w-full resize-y border border-[var(--color-divider)] bg-white/60 px-2.5 py-2 text-sm outline-none focus-visible:border-[var(--color-accent)]"
              placeholder={t.messagePlaceholder}
              value={contact.message}
              onChange={(event) => setContact({ ...contact, message: event.target.value })}
            />
          </div>

          {errorCode && (
            // What the visitor typed stays in the fields, so retrying
            // is one click and not a re-type.
            <p
              role="alert"
              className="mb-3 border-l-[3px] py-0.5 pl-3 text-[13px] leading-relaxed"
              style={{ borderColor: "var(--color-severity-critico)" }}
            >
              {t.contactError[errorCode]}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || justSucceeded}
            className={`flex w-full items-center justify-center gap-2 border border-[var(--color-accent-700)] bg-[var(--color-accent-700)] py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:border-[var(--color-accent-800)] hover:bg-[var(--color-accent-800)] active:bg-[var(--color-accent-900)] ${
              justSucceeded ? "disabled:opacity-100" : "disabled:border-[var(--color-divider)] disabled:bg-[var(--color-neutral-200)] disabled:text-[var(--color-neutral-600)]"
            }`}
          >
            {justSucceeded ? (
              <Check size={16} strokeWidth={2} aria-hidden="true" />
            ) : submitting ? (
              <Loader2 size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" />
            ) : null}
            {justSucceeded ? t.sent : submitting ? t.sending : t.sendButton}
          </button>
        </form>
      )}

      <p className="mt-4 text-[10.5px] text-[var(--color-neutral-700)]">
        {t.reportFooter(report.domain)}{" "}
        {/* Only place this link exists — the last screen of the flow,
            after the visitor is done with the tool. target="_blank" +
            rel="noopener noreferrer" means even an accidental click
            can't navigate this tab away (and closes the tabnabbing
            hole a bare target="_blank" would leave open — notable
            given this app audits other sites for exactly that class
            of oversight). */}
        <a
          href="https://lsdias.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-[var(--color-divider)] underline-offset-2 hover:text-[var(--color-accent-700)] hover:decoration-[var(--color-accent-700)] focus-visible:decoration-[var(--color-accent-700)]"
        >
          {t.madeByLabel}
          <span className="sr-only"> ({t.opensNewTab})</span>
        </a>
      </p>
    </div>
  );
}
