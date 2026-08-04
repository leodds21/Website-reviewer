"use client";

import { useLanguage } from "@/app/i18n/LanguageContext";
import type { Locale } from "@/app/i18n/translations";

function LocaleOption({
  value,
  label,
  active,
  onSelect,
}: {
  value: Locale;
  label: string;
  active: boolean;
  onSelect: (value: Locale) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-current={active}
      className={
        active ? "text-[var(--color-text)]" : "text-[var(--color-neutral-600)] hover:text-[var(--color-accent)]"
      }
    >
      {label}
    </button>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <LocaleOption value="pt" label="PT" active={locale === "pt"} onSelect={setLocale} />
      <span className="text-[var(--color-neutral-200)]">|</span>
      <LocaleOption value="en" label="EN" active={locale === "en"} onSelect={setLocale} />
    </div>
  );
}
