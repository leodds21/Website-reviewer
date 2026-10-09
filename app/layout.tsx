import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import { LanguageProvider } from "./i18n/LanguageContext";
import {
  DICTIONARIES,
  LOCALE_COOKIE,
  type Locale,
} from "./i18n/translations";
import { SITE_URL } from "@/lib/siteUrl";
import "./globals.css";

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

// proxy.ts has already resolved the locale into this cookie.
async function getLocaleFromCookies(): Promise<Locale> {
  const cookieStore = await cookies();
  return cookieStore.get(LOCALE_COOKIE)?.value === "en" ? "en" : "pt";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocaleFromCookies();
  const title = DICTIONARIES[locale].documentTitle;
  const description = DICTIONARIES[locale].subheadline;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocaleFromCookies();

  return (
    <html
      lang={locale === "en" ? "en" : "pt-BR"}
      className={`${spaceGrotesk.variable} ${manrope.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
