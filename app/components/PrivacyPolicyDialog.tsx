"use client";

import { useRef } from "react";
import { useLanguage } from "@/app/i18n/LanguageContext";

export function PrivacyPolicyDialog() {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="text-[var(--color-link)] underline decoration-[var(--color-line-strong)] underline-offset-4 hover:decoration-[var(--color-link)]"
      >
        {t.privacyLinkLabel}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="privacy-policy-title"
        className="w-[92vw] max-w-[460px] rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-[var(--color-body)]"
      >
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="privacy-policy-title" className="text-lg">
            {t.privacyPolicy.title}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t.close}
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-xl leading-none text-[var(--color-subtle)] hover:text-[var(--color-text)]"
          >
            ×
          </button>
        </div>
        <div className="flex max-h-[65vh] flex-col gap-3 overflow-x-hidden overflow-y-auto pr-1 text-sm leading-relaxed text-[var(--color-muted)]">
          {t.privacyPolicy.sections.map((section) => (
            <p key={section.label}>
              <strong className="font-semibold text-[var(--color-text)]">{section.label}:</strong> {section.text}
            </p>
          ))}
        </div>
      </dialog>
    </>
  );
}
