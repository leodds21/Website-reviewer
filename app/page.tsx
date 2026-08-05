"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { ScoreRing } from "./components/ScoreRing";
import { CategoryCard } from "./components/CategoryCard";
import { IssueList } from "./components/IssueList";
import { LoadingSequence, type StepKey } from "./components/LoadingSequence";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { useLanguage } from "./i18n/LanguageContext";
import { translateIssue, type CategoryKey } from "./i18n/translations";
import type { AggregatedScore } from "@/lib/score";
import type { Issue } from "@/lib/issues";

type AnalyzeReport = {
  domain: string;
  score: AggregatedScore;
  issues: Issue[];
  checkedAt: string;
};

type Stage = "idle" | "analyzing" | "report" | "next-step";

const CATEGORY_KEYS: CategoryKey[] = ["performance", "seo", "accessibility", "security"];

function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}

function Brand() {
  return (
    <span className="text-lg font-semibold">
      Isdias<span className="text-[var(--color-accent-700)]">.dev</span>
    </span>
  );
}

export default function Home() {
  const { locale, t } = useLanguage();
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [completedSteps, setCompletedSteps] = useState<StepKey[]>([]);
  const [report, setReport] = useState<AnalyzeReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [contact, setContact] = useState({ name: "", email: "", message: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactJustSucceeded, setContactJustSucceeded] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  function startAnalysis(event: React.FormEvent) {
    event.preventDefault();
    setStage("analyzing");
    setCompletedSteps([]);
    setError(null);
    setReport(null);

    const source = new EventSource(`/api/analyze?url=${encodeURIComponent(url)}`);

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

    source.addEventListener("error", (event) => {
      // The server sends its failure reason in Portuguese regardless of
      // UI language (it's produced deep in the check/PageSpeed layer,
      // not worth threading a locale through the whole backend for a
      // rare error path) — a native connection-level error has no
      // `data` at all, so that case falls back to the localized string.
      const raw = (event as MessageEvent).data;
      const message = raw ? (JSON.parse(raw) as { error: string }).error : t.errorGeneric;
      setError(message);
      setStage("idle");
      source.close();
    });
  }

  async function submitContact(event: React.FormEvent) {
    event.preventDefault();
    const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;
    if (!endpoint) {
      setContactError(t.formNotConfigured);
      return;
    }

    setContactSubmitting(true);
    setContactError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: contact.name,
          email: contact.email,
          message: contact.message,
          _subject: `Isdias.dev: novo contato sobre ${report?.domain}`,
          site: report?.domain,
        }),
      });

      if (response.ok) {
        // Holds the button in its "check" state for a beat before
        // swapping to the confirmation message — an instant swap reads
        // as the click didn't register, not as success.
        setContactSubmitting(false);
        setContactJustSucceeded(true);
        setTimeout(() => setContactSubmitted(true), 1200);
        return;
      }

      setContactError(t.sendError);
    } catch {
      setContactError(t.sendError);
    } finally {
      setContactSubmitting(false);
    }
  }

  const topIssues = report
    ? [...report.issues]
        .sort((a, b) => Number(a.severity !== "critico") - Number(b.severity !== "critico"))
        .slice(0, 2)
    : [];

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-baseline justify-between">
          <Brand />
          <LanguageSwitcher />
        </div>

        {stage === "idle" && (
          <>
            <h1 className="mb-3 text-4xl leading-[1.05] tracking-tight">
              {t.headline[0]}
              <br />
              {t.headline[1]}
            </h1>
            <p className="mb-6 max-w-sm text-[13.5px] leading-relaxed text-[var(--color-text)]/80">
              {t.subheadline}
            </p>

            <form onSubmit={startAnalysis}>
              <label className="mb-1.5 block text-xs text-[var(--color-text)]/70">{t.analyzeLabel}</label>
              <input
                className="mb-3 w-full border border-[var(--color-divider)] bg-white/60 px-2.5 py-2 font-mono text-[13.5px] outline-none focus-visible:border-[var(--color-accent)]"
                placeholder={t.urlPlaceholder}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
              <button
                type="submit"
                disabled={!url}
                className="flex w-full items-center justify-between border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-2.5 font-[var(--font-heading)] text-[14.5px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-600)] disabled:opacity-45"
              >
                {t.runButton} <span>→</span>
              </button>
            </form>

            {error && <p className="mt-4 text-sm text-[var(--color-accent-900)]">{error}</p>}

            <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-neutral-700)] italic">
              {t.privacyNote}
            </p>
          </>
        )}

        {stage === "analyzing" && <LoadingSequence completedSteps={completedSteps} />}

        {stage === "report" && report && (
          <div className="blueprint bg-white/60 p-5">
            <Corners />
            <div className="mb-5 flex items-baseline justify-between">
              <Brand />
              <span className="font-mono text-xs text-[var(--color-neutral-700)]">{report.domain}</span>
            </div>

            <div className="mb-2 flex items-center gap-4">
              <ScoreRing score={report.score.overall} />
              <div>
                <div className="text-[38px] font-semibold leading-none tracking-tight">
                  {report.score.overall}
                  <span className="text-base font-normal text-[var(--color-neutral-700)]"> /100</span>
                </div>
                <span className="mt-1.5 inline-flex border border-[var(--color-accent)] px-2.5 py-0.5 text-[11px] text-[var(--color-accent-700)]">
                  {report.score.overallSeverity === "ok" ? t.scoreLabelOk : t.scoreLabelAttention}
                </span>
              </div>
            </div>

            <div className="mt-5 mb-5 flex flex-col gap-2.5">
              {CATEGORY_KEYS.map((key) => (
                <CategoryCard
                  key={key}
                  category={key}
                  score={report.score[key].score}
                  severity={report.score[key].severity}
                />
              ))}
            </div>

            <IssueList issues={report.issues} />

            <button
              type="button"
              onClick={() => setStage("next-step")}
              className="mt-6 flex w-full items-center justify-center border border-[var(--color-accent)] bg-[var(--color-accent)] py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-600)]"
            >
              {t.nextStepButton}
            </button>
          </div>
        )}

        {stage === "next-step" && report && (
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
                      <span className="text-[var(--color-accent-900)]">☑</span>
                      <span>{translateIssue(locale, issue.code, issue.params).title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {contactSubmitted ? (
              <p className="text-sm text-[var(--color-accent-800)]">{t.sendSuccess}</p>
            ) : (
              <form onSubmit={submitContact}>
                <p className="mb-2.5 text-xs text-[var(--color-text)]/70">{t.contactIntro}</p>
                <div className="mb-2.5">
                  <label className="mb-1 block text-xs text-[var(--color-text)]/70">{t.nameLabel}</label>
                  <input
                    required
                    className="w-full border border-[var(--color-divider)] bg-white/60 px-2.5 py-2 text-sm outline-none focus-visible:border-[var(--color-accent)]"
                    placeholder={t.namePlaceholder}
                    value={contact.name}
                    onChange={(event) => setContact({ ...contact, name: event.target.value })}
                  />
                </div>
                <div className="mb-2.5">
                  <label className="mb-1 block text-xs text-[var(--color-text)]/70">{t.emailLabel}</label>
                  <input
                    required
                    type="email"
                    className="w-full border border-[var(--color-divider)] bg-white/60 px-2.5 py-2 text-sm outline-none focus-visible:border-[var(--color-accent)]"
                    placeholder={t.emailPlaceholder}
                    value={contact.email}
                    onChange={(event) => setContact({ ...contact, email: event.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-xs text-[var(--color-text)]/70">{t.messageLabel}</label>
                  <textarea
                    required
                    rows={3}
                    className="w-full resize-y border border-[var(--color-divider)] bg-white/60 px-2.5 py-2 text-sm outline-none focus-visible:border-[var(--color-accent)]"
                    placeholder={t.messagePlaceholder}
                    value={contact.message}
                    onChange={(event) => setContact({ ...contact, message: event.target.value })}
                  />
                </div>

                {contactError && <p className="mb-3 text-sm text-[var(--color-accent-900)]">{contactError}</p>}

                <button
                  type="submit"
                  disabled={contactSubmitting || contactJustSucceeded}
                  className="flex w-full items-center justify-center gap-2 border border-[var(--color-accent)] bg-[var(--color-accent)] py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-600)] disabled:opacity-100"
                >
                  {contactJustSucceeded ? (
                    <Check size={16} strokeWidth={2} aria-hidden="true" />
                  ) : contactSubmitting ? (
                    <Loader2 size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" />
                  ) : null}
                  {contactJustSucceeded ? t.sent : contactSubmitting ? t.sending : t.sendButton}
                </button>
              </form>
            )}

            <p className="mt-4 text-[10.5px] text-[var(--color-neutral-700)]">{t.reportFooter(report.domain)}</p>
          </div>
        )}
      </div>
    </main>
  );
}
