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

  // On a phone the plan sits below the form, out of view: without this,
  // starting an analysis only changes the button's text and the live
  // progress happens offscreen. Side by side (desktop) it's already in
  // view, so nothing moves.
  useEffect(() => {
    const plan = planRef.current;
    if (!analyzing || !plan) return;
    if (plan.getBoundingClientRect().bottom <= window.innerHeight) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    plan.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }, [analyzing]);

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
            // The typed URL stays in the field, so recovering is "fix the
            // typo and press the button again", not starting over.
            <ErrorNote>{translateAnalysisError(locale, error)}</ErrorNote>
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
