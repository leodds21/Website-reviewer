"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useLanguage } from "@/app/i18n/LanguageContext";
import type { Locale } from "@/app/i18n/locale";

const OPTIONS: { value: Locale; label: string; fullName: string }[] = [
  { value: "pt-BR", label: "PT", fullName: "Português" },
  { value: "en", label: "EN", fullName: "English" },
];

const OPTION_CLASS = "inline-flex min-h-11 items-center border-b-2 px-3 font-mono text-xs";

// A plain link, not client navigation: each language has its own root layout.
export function LanguageSwitcher({ disabled = false }: { disabled?: boolean }) {
  const { locale } = useLanguage();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const rest = pathname.replace(/^\/(pt-BR|en)(?=\/|$)/, "");

  return (
    <div className="flex items-center gap-0.5">
      {OPTIONS.map(({ value, label, fullName }) => {
        // Appended, not an aria-label: the name must contain "PT" for voice control (WCAG 2.5.3).
        const name = (
          <>
            {label}
            <span className="sr-only"> ({fullName})</span>
          </>
        );
        if (value === locale) {
          return (
            <span key={value} aria-current="true" lang={value} className={`${OPTION_CLASS} border-[var(--color-link)] text-[var(--color-text)]`}>
              {name}
            </span>
          );
        }
        // Unavailable while an analysis runs: still announced as a link, just disabled.
        if (disabled) {
          return (
            <a role="link" key={value} aria-disabled="true" lang={value} className={`${OPTION_CLASS} border-transparent text-[var(--color-line-strong)]`}>
              {name}
            </a>
          );
        }
        return (
          <a
            key={value}
            href={`/${value}${rest}${search ? `?${search}` : ""}`}
            hrefLang={value}
            lang={value}
            className={`${OPTION_CLASS} border-transparent text-[var(--color-subtle)] hover:text-[var(--color-text)]`}
          >
            {name}
          </a>
        );
      })}
    </div>
  );
}
