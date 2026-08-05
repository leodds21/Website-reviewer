"use client";

import { useRef } from "react";
import { Corners } from "./Chrome";
import { useLanguage } from "@/app/i18n/LanguageContext";

export function PrivacyPolicyDialog() {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="not-italic underline decoration-[var(--color-divider)] underline-offset-2 hover:decoration-[var(--color-accent-700)] hover:text-[var(--color-accent-700)] focus-visible:decoration-[var(--color-accent-700)]"
      >
        {t.privacyLinkLabel}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="privacy-policy-title"
        className="blueprint w-[92vw] max-w-[420px] bg-[var(--color-bg)] p-5 shadow-lg"
      >
        <Corners />
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="privacy-policy-title" className="text-lg font-semibold">
            {t.privacyPolicy.title}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t.close}
            className="text-lg leading-none text-[var(--color-neutral-700)] hover:text-[var(--color-text)] focus-visible:text-[var(--color-text)]"
          >
            ×
          </button>
        </div>
        <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto overflow-x-hidden pr-1 text-[12.5px] leading-relaxed text-[var(--color-text)]/80">
          {t.privacyPolicy.sections.map((section, index) => (
            <p key={index}>
              <strong className="font-semibold text-[var(--color-text)]">{section.label}:</strong> {section.text}
            </p>
          ))}
        </div>
      </dialog>
    </>
  );
}
