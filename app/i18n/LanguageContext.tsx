"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DICTIONARIES, LOCALE_STORAGE_KEY, type Dictionary, type Locale } from "./translations";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === "pt" || value === "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Starts as "pt" so server and first client render match (no
  // access to localStorage/navigator during SSR); synced to the
  // real preference right after mount.
  const [locale, setLocaleState] = useState<Locale>("pt");

  useEffect(() => {
    // localStorage can throw (Safari private mode, cookies/storage
    // blocked by the user or an extension) — a read failure just means
    // "no stored preference," not a reason to break the page.
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      // ignore, fall back to navigator.language below
    }
    const resolved = isLocale(stored) ? stored : navigator.language.toLowerCase().startsWith("en") ? "en" : "pt";
    // One-time sync from an external system (localStorage/navigator)
    // that isn't available during SSR — can't be done any other way
    // without a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(resolved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "pt-BR";
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Preference just won't persist across visits — not fatal.
    }
  }

  const value = useMemo(() => ({ locale, setLocale, t: DICTIONARIES[locale] }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
