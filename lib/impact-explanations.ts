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

  // lib/checks/meta-tags.ts
  "no-title": {
    text: "A aba do navegador e os resultados de busca do Google mostram o site sem nenhum nome. Isso dificulta a pessoa reconhecer ou lembrar do site depois de encontrar num resultado de busca.",
  },
  "generic-title": {
    text: "O título que aparece no Google pra esse site é genérico demais (tipo \"Home\"), sem dizer nada sobre o que o negócio oferece. Quem está buscando não tem motivo pra escolher esse resultado em vez do concorrente.",
  },
  "no-description": {
    text: "Falta o textinho que aparece embaixo do link nos resultados do Google. Sem ele, o Google escolhe um trecho aleatório da página pra mostrar, o que deixa o resultado menos convidativo na hora de decidir em qual link clicar.",
  },
  "no-viewport": {
    text: "Em celular, a página pode aparecer minúscula, exigindo que a pessoa dê zoom pra ler qualquer coisa. A maior parte de quem acessa a internet hoje faz isso pelo celular, então essa experiência ruim atinge boa parte dos visitantes.",
  },
};
