"use client";

import { useLanguage } from "@/app/i18n/LanguageContext";
import type { Locale } from "@/app/i18n/translations";

function LocaleOption({
  value,
  label,
  fullName,
  active,
  onSelect,
}: {
  value: Locale;
  label: string;
  fullName: string;
  active: boolean;
  onSelect: (value: Locale) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      lang={value}
      className={`inline-flex min-h-11 items-center border-b-2 px-3 font-mono text-xs ${
        active
          ? "border-[var(--color-link)] text-[var(--color-text)]"
          : "border-transparent text-[var(--color-subtle)] hover:text-[var(--color-text)]"
      }`}
    >
      {/* Appended, not an aria-label: the name must contain "PT" for
          voice control (WCAG 2.5.3). */}
      {label}
      <span className="sr-only"> ({fullName})</span>
    </button>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex items-center gap-0.5">
      <LocaleOption value="pt" label="PT" fullName="Português" active={locale === "pt"} onSelect={setLocale} />
      <LocaleOption value="en" label="EN" fullName="English" active={locale === "en"} onSelect={setLocale} />
    </div>
  );
}
