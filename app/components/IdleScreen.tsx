"use client";

import { Brand, Corners } from "./Chrome";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { PrivacyPolicyDialog } from "./PrivacyPolicyDialog";
import { useLanguage } from "@/app/i18n/LanguageContext";

export function IdleScreen({
  url,
  onUrlChange,
  onSubmit,
  error,
}: {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  error: string | null;
}) {
  const { t } = useLanguage();

  return (
    <div className="blueprint bg-white/60 p-5">
      <Corners />
      <div className="mb-8 flex items-baseline justify-between">
        <Brand />
        <LanguageSwitcher />
      </div>

      <h1 className="mb-3 text-4xl leading-[1.05] tracking-tight">
        {t.headline[0]}
        <br />
        {t.headline[1]}
      </h1>
      <p className="mb-6 max-w-sm text-[13.5px] leading-relaxed text-[var(--color-text)]/80">{t.subheadline}</p>

      <form onSubmit={onSubmit}>
        <label htmlFor="analyze-url" className="mb-1.5 block text-xs text-[var(--color-text)]/70">
          {t.analyzeLabel}
        </label>
        <input
          id="analyze-url"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          className="mb-3 w-full border border-[var(--color-divider)] bg-white/60 px-2.5 py-2 font-mono text-[13.5px] outline-none focus-visible:border-[var(--color-accent)]"
          placeholder={t.urlPlaceholder}
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
        />
        <button
          type="submit"
          disabled={!url.trim()}
          className="flex w-full cursor-pointer items-center justify-between border border-[var(--color-accent-700)] bg-[var(--color-accent-700)] px-4 py-2.5 font-[var(--font-heading)] text-[14.5px] font-semibold text-white transition-colors hover:border-[var(--color-accent-800)] hover:bg-[var(--color-accent-800)] active:bg-[var(--color-accent-900)] disabled:cursor-not-allowed disabled:border-[var(--color-divider)] disabled:bg-[var(--color-neutral-200)] disabled:text-[var(--color-neutral-600)]"
        >
          {t.runButton} <span aria-hidden="true">→</span>
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--color-accent-900)]">
          {error}
        </p>
      )}

      <div className="mt-6 text-[11.5px] leading-relaxed text-[var(--color-neutral-700)] italic">
        {t.privacyNote} <PrivacyPolicyDialog />
      </div>
    </div>
  );
}
