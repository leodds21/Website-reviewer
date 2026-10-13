import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import { OG_LOCALE, type Locale } from "../i18n/locale";
import { DICTIONARIES } from "../i18n/dictionaries";
import { SITE_URL } from "@/lib/siteUrl";
import "../globals.css";

// Self-hosted by next/font, so the CSP's font-src 'self' holds.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  weight: ["500", "600"],
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export function rootMetadata(locale: Locale): Metadata {
  const { documentTitle: title, subheadline: description } = DICTIONARIES[locale];
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: { title, description, type: "website", locale: OG_LOCALE[locale], siteName: "lsdias.dev scanner" },
    twitter: { card: "summary_large_image", title, description },
  };
}

// Canonical and hreflang for a page that exists in both languages at `path`.
export function localizedAlternates(locale: Locale, path = ""): Metadata["alternates"] {
  return {
    canonical: `/${locale}${path}`,
    languages: { "pt-BR": `/pt-BR${path}`, en: `/en${path}`, "x-default": path || "/" },
  };
}

export function RootLayout({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <html lang={locale} className={`${spaceGrotesk.variable} ${manrope.variable} ${jetBrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
