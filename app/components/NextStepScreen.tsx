"use client";

import { Loader2, Check } from "lucide-react";
import { Brand, Corners } from "./Chrome";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { translateIssue } from "@/app/i18n/translations";
import { useContactForm } from "@/app/hooks/useContactForm";
import type { AnalyzeReport } from "@/lib/report";
import type { Issue } from "@/lib/issues";

export function NextStepScreen({ report, topIssues }: { report: AnalyzeReport; topIssues: Issue[] }) {
  const { locale, t } = useLanguage();
  const { contact, setContact, submitting, justSucceeded, succeeded, errorMessage, submitContact } = useContactForm({
    domain: report.domain,
    formNotConfigured: t.formNotConfigured,
    sendError: t.sendError,
  });

  return (
    <div className="blueprint bg-white/60 p-5">
      <Corners />
      <div className="mb-5 flex items-baseline justify-between">
        <Brand />
      </div>

      <div className="mb-2 text-xs font-semibold tracking-[0.12em] text-[var(--color-accent-700)] uppercase">
        {t.nextStepKicker}
      </div>
      <h3 className="mb-3 text-[22px] leading-[1.15] tracking-tight">{t.nextStepHeadline}</h3>
      <p className="mb-4 text-[13px] leading-relaxed text-[var(--color-text)]/80">
        {topIssues.length >= 2 ? t.nextStepBodyTwo : t.nextStepBodyFew}
      </p>

      {topIssues.length > 0 && (
        <div className="blueprint mb-4 p-3.5">
          <Corners />
          <div className="flex flex-col gap-2">
            {topIssues.map((issue, index) => (
              <div key={index} className="flex gap-2 text-[12.5px]">
                <span className="text-[var(--color-accent-900)]" aria-hidden="true">
                  ☑
                </span>
                <span>{translateIssue(locale, issue.code, issue.params).title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {succeeded ? (
        <p className="text-sm text-[var(--color-accent-800)]">{t.sendSuccess}</p>
      ) : (
        <form onSubmit={submitContact}>
          <p className="mb-2.5 text-xs text-[var(--color-text)]/70">{t.contactIntro}</p>
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

          {errorMessage && (
            <p role="alert" className="mb-3 text-sm text-[var(--color-accent-900)]">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || justSucceeded}
            className={`flex w-full items-center justify-center gap-2 border border-[var(--color-accent)] bg-[var(--color-accent)] py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-600)] ${
              justSucceeded ? "disabled:opacity-100" : "disabled:opacity-45"
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

      <p className="mt-4 text-[10.5px] text-[var(--color-neutral-700)]">{t.reportFooter(report.domain)}</p>
    </div>
  );
}
