"use client";

import { LanguageProvider } from "./LanguageContext";
import { en } from "./dictionaries/en";

export function EnLanguage({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider locale="en" t={en}>
      {children}
    </LanguageProvider>
  );
}
