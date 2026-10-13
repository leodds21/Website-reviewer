"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./locale";
import type { Dictionary } from "./types";

type LanguageContextValue = { locale: Locale; t: Dictionary };

const LanguageContext = createContext<LanguageContextValue | null>(null);

// Each locale's root layout renders this through its own wrapper
// (PtBrLanguage, EnLanguage), so a page only ships its own dictionary.
export function LanguageProvider({ locale, t, children }: LanguageContextValue & { children: React.ReactNode }) {
  return <LanguageContext.Provider value={{ locale, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
