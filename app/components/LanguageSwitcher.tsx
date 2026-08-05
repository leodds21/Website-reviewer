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
      aria-label={fullName}
      lang={value}
      className={
        active ? "text-[var(--color-text)]" : "text-[var(--color-neutral-700)] hover:text-[var(--color-accent-700)]"
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
      <LocaleOption value="pt" label="PT" fullName="Português" active={locale === "pt"} onSelect={setLocale} />
      <span className="text-[var(--color-neutral-200)]" aria-hidden="true">
        |
      </span>
      <LocaleOption value="en" label="EN" fullName="English" active={locale === "en"} onSelect={setLocale} />
    </div>
  );
}
