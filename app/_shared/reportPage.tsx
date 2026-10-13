import type { Metadata } from "next";
import { AppHeader, Brand, PageContainer, buttonClass } from "../components/Chrome";
import { DICTIONARIES } from "../i18n/dictionaries";
import { OG_LOCALE, type Locale } from "../i18n/locale";
import { localizedAlternates } from "./RootLayout";
import { SharedReport } from "./SharedReport";
import { getStoredReport } from "@/lib/reportStore";

type Params = Promise<{ id: string }>;

export async function reportMetadata(locale: Locale, params: Params): Promise<Metadata> {
  const { id } = await params;
  const t = DICTIONARIES[locale];
  const stored = await getStoredReport(id);
  // Reports are about other people's sites: shareable, but not for search results.
  const robots = { index: false, follow: false };
  if (!stored) return { title: `${t.reportExpiredTitle} | ${t.documentTitle}`, robots };

  const { domain, score } = stored.report;
  const overall = score.overallSeverity === "indisponivel" ? null : score.overall;
  const title = `${overall === null ? domain : `${overall} · ${domain}`} | ${t.documentTitle}`;
  const description = t.reportDescription(domain, overall);
  return {
    title,
    description,
    robots,
    alternates: localizedAlternates(locale, `/report/${id}`),
    openGraph: { title, description, type: "article", locale: OG_LOCALE[locale] },
    twitter: { card: "summary_large_image", title, description },
  };
}

export async function ReportPage({ locale, params }: { locale: Locale; params: Params }) {
  const { id } = await params;
  const stored = await getStoredReport(id);
  if (stored) return <SharedReport report={stored.report} />;

  const t = DICTIONARIES[locale];
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader>
        <Brand />
      </AppHeader>
      <PageContainer className="flex flex-1 flex-col items-start gap-4 py-16">
        <h1 className="font-heading text-3xl tracking-[-0.02em]">{t.reportExpiredTitle}</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">{t.reportExpiredBody}</p>
        <a href={`/${locale}`} className={`${buttonClass.primary} mt-2`}>
          {t.reportExpiredAction}
        </a>
      </PageContainer>
    </div>
  );
}
