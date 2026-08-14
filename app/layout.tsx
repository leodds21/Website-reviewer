import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { cookies } from "next/headers";
import { LanguageProvider } from "./i18n/LanguageContext";
import {
  DICTIONARIES,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "./i18n/translations";
import { SITE_URL } from "@/lib/siteUrl";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-body",
  weight: ["400", "500"],
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-heading",
  weight: ["400", "600"],
  subsets: ["latin"],
});

// proxy.ts resolves the visitor's locale (from ?lang=, an existing cookie,
// or Accept-Language) and writes it to this same cookie before the request
// gets here, so this always reflects that resolution rather than guessing.
async function getLocaleFromCookies(): Promise<Locale> {
  const cookieStore = await cookies();
  return cookieStore.get(LOCALE_STORAGE_KEY)?.value === "en" ? "en" : "pt";
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
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
