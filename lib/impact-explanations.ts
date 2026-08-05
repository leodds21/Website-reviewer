import type { IssueCode } from "./issues";

/**
 * Plain-language explanation of what a technical finding means in
 * practice for a non-technical site owner — the "so what" behind the
 * already-shown technical description, not a replacement for it.
 *
 * Deliberately a Partial: filled in one check module at a time (see
 * lib/checks/), so a code without an entry yet just has no
 * plain-language layer rather than forcing every code to be written
 * before any of this compiles.
 *
 * `source` is set only when `text` leans on a specific, verifiable
 * stat about real-world impact (a public study, not a guess dressed
 * up as data). Most findings don't have one and stay qualitative —
 * forcing a number in without a real source would undermine the
 * report's credibility more than the honest problem description does
 * on its own.
 */
export type ImpactExplanation = {
  text: string;
  source?: string;
};

export const IMPACT_EXPLANATIONS: Partial<Record<IssueCode, ImpactExplanation>> = {
  // lib/checks/https.ts
  "no-https": {
    text: "Seu site aparece com o aviso \"não seguro\" no navegador do visitante. Isso passa desconfiança, principalmente se a pessoa for preencher algum formulário ou fazer uma compra.",
  },
  "invalid-certificate": {
    text: "O certificado de segurança do site tem um problema de configuração. Na maioria dos navegadores isso passa despercebido, mas em alguns aparelhos, apps ou navegadores mais rigorosos o site pode aparecer com alerta de segurança.",
  },
};
