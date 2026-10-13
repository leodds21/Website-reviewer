"use client";

import { LanguageProvider } from "./LanguageContext";
import { ptBR } from "./dictionaries/pt-BR";

export function PtBrLanguage({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider locale="pt-BR" t={ptBR}>
      {children}
    </LanguageProvider>
  );
}
