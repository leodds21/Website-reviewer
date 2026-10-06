"use client";

import { Loader2, Check } from "lucide-react";
import { AppHeader, Brand, ErrorNote, PageContainer, buttonClass } from "./Chrome";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { synthesizeCriticalImpact, translateIssue, translateRecommendation } from "@/app/i18n/translations";
import { useContactForm } from "@/app/hooks/useContactForm";
import type { AnalyzeReport } from "@/lib/report";
import type { Issue } from "@/lib/issues";

const fieldClass =
  "w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-field)] px-3.5 py-3 text-[15px] text-[var(--color-text)]";

export function NextStepScreen({
  report,
  topIssues,
  manualReview = false,
  onBack,
}: {
  report: AnalyzeReport;
  topIssues: Issue[];
  manualReview?: boolean;
  onBack: () => void;
}) {
  const { locale, t } = useLanguage();
  const copy = manualReview
    ? { kicker: t.manualKicker, headline: t.manualHeadline, body: t.manualBody }
    : report.issues.length === 0
      ? { kicker: t.nextStepKicker, headline: t.cleanHeadline, body: t.cleanBody }
      : { kicker: t.nextStepKicker, headline: t.nextStepHeadline, body: t.nextStepBody };
  const { contact, setContact, submitting, justSucceeded, succeeded, errorCode, submitContact } = useContactForm({
    domain: report.domain,
    initialMessage: manualReview ? t.manualMessagePrefill(report.domain) : "",
  });

  // One short summary sentence tying the critical findings together,
  // right before the form; null when nothing critical was found.
  const criticalIssues = report.issues.filter((issue) => issue.severity === "critico");
  const impactSynthesis = synthesizeCriticalImpact(locale, criticalIssues);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
          <Brand />
          <span className="font-mono text-[13px] break-all text-[var(--color-body)]">{report.domain}</span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className={buttonClass.secondary}
        >
          <span aria-hidden="true">←&nbsp;</span>
          {t.backToReport}
        </button>
      </AppHeader>

      <PageContainer className="grid flex-1 items-start gap-10 py-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16 lg:py-14">
        <section className="flex min-w-0 flex-col gap-6">
          <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-label)] uppercase">{copy.kicker}</p>
          <h1 className="text-[34px] leading-[1.08] font-medium tracking-[-0.03em] sm:text-[44px]">{copy.headline}</h1>
          <p className="text-base leading-relaxed text-[var(--color-muted)]">{copy.body}</p>

          {topIssues.length > 0 && (
            <div className="flex flex-col">
              <h2 className="mb-1 text-lg">{t.recommendationsHeading}</h2>
              <ol className="flex flex-col">
                {topIssues.map((issue, index) => (
                  <li key={issue.code} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-[var(--color-line)] py-4 last:border-b-0">
                    <span className="font-heading text-2xl leading-none font-medium text-[var(--color-text)]">{index + 1}</span>
                    <div className="flex flex-col gap-1">
                      <p className="text-[15px] font-semibold text-[var(--color-text)]">{translateIssue(locale, issue.code, issue.params).title}</p>
                      <p className="text-sm leading-relaxed text-[var(--color-muted)]">{translateRecommendation(locale, issue.code)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {impactSynthesis && <p className="text-[15px] leading-relaxed text-[var(--color-body)]">{impactSynthesis}</p>}
        </section>

        <section className="flex flex-col gap-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-7">
          {succeeded ? (
            // Names the address the reply goes to: the fields are gone by
            // now, so this is the only chance to notice a typo in it.
            <div role="status" className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
                <Check size={18} strokeWidth={2.5} aria-hidden="true" className="text-[var(--color-severity-ok)]" />
                {t.sendSuccess}
              </p>
              <p className="text-sm text-[var(--color-muted)]">{t.sendSuccessDetail(contact.email)}</p>
            </div>
          ) : (
            <form onSubmit={submitContact} className="flex flex-col gap-4">
              <h2 className="text-xl">{t.contactHeading}</h2>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-name" className="text-sm font-semibold text-[var(--color-body)]">
                  {t.nameLabel}
                </label>
                <input
                  id="contact-name"
                  required
                  autoComplete="name"
                  className={fieldClass}
                  placeholder={t.namePlaceholder}
                  value={contact.name}
                  onChange={(event) => setContact({ ...contact, name: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-email" className="text-sm font-semibold text-[var(--color-body)]">
                  {t.emailLabel}
                </label>
                <input
                  id="contact-email"
                  required
                  type="email"
                  autoComplete="email"
                  className={fieldClass}
                  placeholder={t.emailPlaceholder}
                  value={contact.email}
                  onChange={(event) => setContact({ ...contact, email: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-message" className="text-sm font-semibold text-[var(--color-body)]">
                  {t.messageLabel}
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={4}
                  className={`${fieldClass} resize-y`}
                  placeholder={t.messagePlaceholder}
                  value={contact.message}
                  onChange={(event) => setContact({ ...contact, message: event.target.value })}
                />
              </div>

              {errorCode && (
                // What the visitor typed stays in the fields, so retrying
                // is one click and not a re-type.
                <ErrorNote>{t.contactError[errorCode]}</ErrorNote>
              )}

              <button
                type="submit"
                disabled={submitting || justSucceeded}
                className="flex min-h-13 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-6 py-3 font-heading text-base font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-80"
              >
                {justSucceeded ? (
                  <Check size={17} strokeWidth={2.5} aria-hidden="true" />
                ) : submitting ? (
                  <Loader2 size={17} strokeWidth={2} aria-hidden="true" className="animate-spin" />
                ) : null}
                {justSucceeded ? t.sent : submitting ? t.sending : t.sendButton}
              </button>
            </form>
          )}

          <p className="border-t border-[var(--color-line)] pt-4 text-xs text-[var(--color-subtle)]">
            {t.reportFooter(report.domain)}{" "}
            {/* target="_blank" + rel="noopener noreferrer": an accidental
                click can't navigate this tab away, and there's no
                tabnabbing hole (the class of issue this app checks other
                sites for). */}
            <a
              href="https://lsdias.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-link)] underline decoration-[var(--color-line-strong)] underline-offset-4 hover:decoration-[var(--color-link)]"
            >
              {t.madeByLabel}
              <span className="sr-only"> ({t.opensNewTab})</span>
            </a>
          </p>
        </section>
      </PageContainer>
    </div>
  );
}
