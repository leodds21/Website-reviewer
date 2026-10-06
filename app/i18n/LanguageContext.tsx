"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DICTIONARIES, LOCALE_COOKIE, type Dictionary, type Locale } from "./translations";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

// The cookie is the only persistence: proxy.ts and layout.tsx read it
// server-side, so it's what makes a manual toggle survive a reload.
function writeLocaleCookie(locale: Locale) {
  const oneYear = 60 * 60 * 24 * 365;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${oneYear}; samesite=lax${secure}`;
}

export function LanguageProvider({
  children,
  initialLocale = "pt",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  // proxy.ts + layout.tsx already resolved the visitor's locale (from
  // ?lang=, an existing cookie, or Accept-Language) before this ever
  // renders, so the first client render starts correct instead of
  // guessing "pt" and fixing itself after the fact.
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // The tab title is the page's to set (it names the open report), not
  // the language's: writing it here too ran after the page's own effect
  // and could put the plain title back over "56 · site.com | …".
  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "pt-BR";
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    writeLocaleCookie(next);
  }

  const value = useMemo(() => ({ locale, setLocale, t: DICTIONARIES[locale] }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
