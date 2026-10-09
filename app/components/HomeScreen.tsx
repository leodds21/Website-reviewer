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

/**
 * Scrolls an element into view only when it isn't fully on screen. On a
 * phone the form and the plan are stacked, so whatever changes (the live
 * progress, or the message a run ends with) can be out of view; side by
 * side on desktop it never is, so nothing moves there.
 */
function revealIfHidden(element: HTMLElement | null, block: ScrollLogicalPosition) {
  if (!element) return;
  const { top, bottom } = element.getBoundingClientRect();
  if (top >= 0 && bottom <= window.innerHeight) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ block, behavior: reduceMotion ? "auto" : "smooth" });
}

/**
 * Start and progress on one screen: the form on the left, the plan of
 * real checks on the right. Submitting doesn't swap screens; the same
 * plan turns into live progress, so the visitor watches exactly what
 * they were told would be checked.
 */
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

  // Starting a run brings the live progress into view; a run that ends in
  // an error (or a link past the cache) brings its message back into view,
  // since on a phone the page is by then scrolled down to the plan.
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
                // A report link past the cache: nothing went wrong, so a
                // neutral note, with the address already in the field.
                <p role="status" className="rounded-lg border border-[var(--color-line)] px-4 py-3 text-sm leading-relaxed text-[var(--color-muted)]">
                  {translateAnalysisError(locale, error)}
                </p>
              ) : (
                // The typed URL stays in the field, so recovering is "fix the
                // typo and press the button again", not starting over.
                <ErrorNote>{translateAnalysisError(locale, error)}</ErrorNote>
              )}
            </div>
          )}

          {/* A div, not a <p>: the privacy link carries its <dialog>,
              which can't live inside a paragraph. */}
          <div className="text-[13px] leading-relaxed text-[var(--color-subtle)]">
            {t.privacyNote} <PrivacyPolicyDialog />
          </div>
        </section>

        <ScanPlan ref={planRef} running={analyzing} completedSteps={completedSteps} />
      </PageContainer>
    </div>
  );
}
