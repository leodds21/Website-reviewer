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

  // lib/checks/alt-images.ts
  "missing-alt": {
    text: "Sem a descrição alternativa, quem usa leitor de tela (pessoas com deficiência visual) não sabe o que aquelas imagens mostram — pra elas, é como se a imagem simplesmente não existisse. Também reduz a chance de essas imagens aparecerem nas buscas do Google.",
  },

  // lib/checks/sitemap-robots.ts
  "no-sitemap": {
    text: "O sitemap é como um mapa que ajuda o Google a encontrar todas as páginas do site, principalmente as mais novas. Sem ele, uma página recém-publicada pode demorar bem mais pra aparecer nos resultados de busca.",
  },

  // lib/pagespeed.ts
  "low-performance": {
    text: "Quanto mais devagar o site carrega, maior a chance de a pessoa desistir antes mesmo de ver o conteúdo. Velocidade de carregamento também é um dos fatores que o Google leva em conta pra decidir a posição do site nas buscas.",
  },
  "slow-load-impact": {
    // The specific seconds/percentage numbers are already computed and
    // shown per-finding (see LOAD_IMPACT_BUCKETS in lib/issues.ts) —
    // this doesn't restate them, just reinforces that the number above
    // isn't a guess, tracing back to the same cited source.
    text: "Cada segundo a mais de espera aumenta a chance de a pessoa sair do site antes de ver qualquer coisa — o número acima não é uma estimativa aleatória, vem de uma pesquisa real sobre esse comportamento.",
    source: "Análise do Google sobre dados do Chrome UX Report, ~900 mil páginas mobile.",
  },
};
