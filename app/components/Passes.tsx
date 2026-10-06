"use client";

import { Check } from "lucide-react";
import { ToggleSummary } from "./Chrome";
import { useLanguage } from "@/app/i18n/LanguageContext";
import type { Pass } from "@/lib/passes";

/**
 * What the checks found right. Collapsed under the findings, since the
 * problems are what to act on; open from the start when there are no
 * findings, because then it's the substance of the report.
 */
export function Passes({ passes, open }: { passes: Pass[]; open: boolean }) {
  const { t } = useLanguage();
  if (passes.length === 0) return null;

  return (
    <section aria-labelledby="passes-heading" className="flex flex-col gap-3.5">
      <h2 id="passes-heading" className="text-2xl tracking-[-0.015em]">
        {t.passesHeading}
      </h2>
      <details open={open} className="rounded-lg border border-[var(--color-line)]">
        <ToggleSummary className="flex min-h-12 px-5 text-sm font-semibold sm:px-6">{t.passesToggle(passes.length)}</ToggleSummary>
        <ul className="border-t border-[var(--color-line)]">
          {passes.map((pass) => (
            <li
              key={pass.code}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--color-line)] px-5 py-3 last:border-b-0 sm:px-6"
            >
              <span className="flex items-baseline gap-2.5 text-[15px] text-[var(--color-body)]">
                <Check size={14} strokeWidth={2.5} aria-hidden="true" className="shrink-0 translate-y-0.5 text-[var(--color-severity-ok)]" />
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
