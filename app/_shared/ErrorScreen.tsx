"use client";

import { AppHeader, Brand, PageContainer, buttonClass } from "../components/Chrome";
import { useLanguage } from "../i18n/LanguageContext";

// A temporary failure (storage unreachable, a script that didn't load): never
// shown as "expired" or "not found", since retrying can work.
export function ErrorScreen({ retry }: { retry: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader>
        <Brand />
      </AppHeader>
      <PageContainer className="flex flex-1 flex-col items-start gap-4 py-16">
        <h1 className="font-heading text-3xl tracking-[-0.02em]">{t.errorTitle}</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">{t.errorBody}</p>
        <button type="button" onClick={() => retry()} className={`${buttonClass.primary} mt-2`}>
          {t.errorRetry}
        </button>
      </PageContainer>
    </div>
  );
}
