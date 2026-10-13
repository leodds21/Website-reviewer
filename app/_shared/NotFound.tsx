import { AppHeader, Brand, PageContainer, buttonClass } from "../components/Chrome";
import { DICTIONARIES } from "../i18n/dictionaries";
import type { Locale } from "../i18n/locale";

export function NotFound({ locale }: { locale: Locale }) {
  const t = DICTIONARIES[locale];
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader>
        <Brand />
      </AppHeader>
      <PageContainer className="flex flex-1 flex-col items-start gap-6 py-16">
        <h1 className="font-heading text-3xl tracking-[-0.02em]">{t.notFoundTitle}</h1>
        <a href={`/${locale}`} className={buttonClass.primary}>
          {t.notFoundAction}
        </a>
      </PageContainer>
    </div>
  );
}
