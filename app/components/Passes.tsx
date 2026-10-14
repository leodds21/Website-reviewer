"use client";

import { CheckIcon } from "./Icons";
import { ToggleSummary } from "./Chrome";
import { useLanguage } from "@/app/i18n/LanguageContext";
import type { Pass } from "@/lib/passes";

// Collapsed, unless there are no findings and this is the whole report.
export function Passes({ passes: all, open }: { passes: Pass[]; open: boolean }) {
  const { t } = useLanguage();
  // A newer server can send a pass this bundle can't word.
  const passes = all.filter((pass) => t.pass[pass.code]);
  if (passes.length === 0) return null;

  return (
    <section aria-labelledby="passes-heading" className="flex flex-col gap-4">
      <h2 id="passes-heading" className="text-[28px] tracking-[-0.02em]">
        {t.passesHeading}
      </h2>
      <details open={open} className="rounded-xl border border-[var(--color-line)]">
        <ToggleSummary className="flex min-h-14 px-5 text-sm font-semibold sm:px-7">{t.passesToggle(passes.length)}</ToggleSummary>
        <ul className="border-t border-[var(--color-line)] print:border-t-0">
          {passes.map((pass) => (
            <li
              key={pass.code}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--color-line)] px-5 py-3.5 last:border-b-0 sm:px-7"
            >
              <span className="flex items-baseline gap-2.5 text-[15px] text-[var(--color-body)]">
                <CheckIcon size={14} strokeWidth={2.5} className="shrink-0 translate-y-0.5 text-[var(--color-severity-ok)]" />
                {t.pass[pass.code]}
              </span>
              <span className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-subtle)] uppercase">{t.categories[pass.category]}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
