"use client";

import { useEffect, useRef } from "react";
import { AppHeader, Brand, ErrorNote, PageContainer } from "./Chrome";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { PrivacyPolicyDialog } from "./PrivacyPolicyDialog";
import { ScanPlan } from "./ScanPlan";
import { useLanguage } from "@/app/i18n/LanguageContext";
import { translateAnalysisError } from "@/app/i18n/translations";
import type { AnalyzeError } from "@/lib/analyzeError";
import type { StepKey } from "@/lib/scanSteps";

// On phones the form and plan are stacked, so either can be off screen.
function revealIfHidden(element: HTMLElement | null, block: ScrollLogicalPosition) {
  if (!element) return;
  const { top, bottom } = element.getBoundingClientRect();
  if (top >= 0 && bottom <= window.innerHeight) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ block, behavior: reduceMotion ? "auto" : "smooth" });
}

export function HomeScreen({
  url,
  onUrlChange,
  onSubmit,
  error,
  analyzing,
  completedSteps,
}: {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  error: AnalyzeError | null;
  analyzing: boolean;
  completedSteps: StepKey[];
}) {
  const { locale, t } = useLanguage();
  const planRef = useRef<HTMLElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (analyzing) revealIfHidden(planRef.current, "start");
  }, [analyzing]);
  useEffect(() => {
    if (error) revealIfHidden(noteRef.current, "center");
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader>
        <Brand />
        <LanguageSwitcher />
      </AppHeader>

      <PageContainer className="grid flex-1 items-center gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <section className="flex min-w-0 flex-col gap-7">
          <h1 className="text-[40px] leading-[1.02] font-medium tracking-[-0.035em] sm:text-6xl">{t.homeHeadline}</h1>
          <p className="max-w-[520px] text-[17px] leading-relaxed text-[var(--color-muted)]">{t.homeIntro}</p>

          <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
            <label htmlFor="analyze-url" className="text-sm font-semibold text-[var(--color-body)]">
              {t.analyzeLabel}
            </label>
            <input
              id="analyze-url"
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              disabled={analyzing}
              placeholder={t.urlPlaceholder}
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              className="min-h-14 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-field)] px-4 font-mono text-base text-[var(--color-text)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={analyzing || !url.trim()}
              className="min-h-14 rounded-full bg-[var(--color-accent)] px-7 font-heading text-[17px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-line-strong)] disabled:text-[var(--color-muted)]"
            >
              {analyzing ? t.runningButton : t.runButton}
            </button>
          </form>

          {error && (
            <div ref={noteRef}>
              {error.code === "not-cached" ? (
                // An expired report link isn't an error, so a neutral note.
                <p role="status" className="rounded-lg border border-[var(--color-line)] px-4 py-3 text-sm leading-relaxed text-[var(--color-muted)]">
                  {translateAnalysisError(locale, error)}
                </p>
              ) : (
                <ErrorNote>{translateAnalysisError(locale, error)}</ErrorNote>
              )}
            </div>
          )}

          {/* A div: the privacy link's <dialog> can't live inside a <p>. */}
          <div className="text-[13px] leading-relaxed text-[var(--color-subtle)]">
            {t.privacyNote} <PrivacyPolicyDialog />
          </div>
        </section>

        <ScanPlan ref={planRef} running={analyzing} completedSteps={completedSteps} />
      </PageContainer>
    </div>
  );
}
