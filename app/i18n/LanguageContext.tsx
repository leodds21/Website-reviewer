"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DICTIONARIES, LOCALE_STORAGE_KEY, type Dictionary, type Locale } from "./translations";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

// LOCALE_STORAGE_KEY doubles as the cookie name proxy.ts and layout.tsx
// use server-side — same concept, one shared constant.
function writeLocaleCookie(locale: Locale) {
  const oneYear = 60 * 60 * 24 * 365;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; path=/; max-age=${oneYear}; samesite=lax${secure}`;
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

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "pt-BR";
    document.title = DICTIONARIES[locale].documentTitle;
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Safari private mode, storage blocked by the user/an extension —
      // a write failure just means the choice won't persist, not fatal.
    }
    // Without this, a manual toggle followed by a full reload lands back
    // on the server-resolved locale (no ?lang=, no prior cookie) instead
    // of what was just picked — localStorage alone isn't visible to
    // layout.tsx, only a cookie is.
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
