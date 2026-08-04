import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { LanguageProvider } from "./i18n/LanguageContext";
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

export const metadata: Metadata = {
  title: "Isdias.dev — diagnóstico de site",
  description: "Performance, SEO, acessibilidade e segurança do seu site em menos de um minuto.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
