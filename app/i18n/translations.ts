import type { IssueCategory, IssueCode } from "@/lib/issues";
import type { Severity } from "@/lib/score";

export type Locale = "pt" | "en";

export const LOCALE_STORAGE_KEY = "isdias-lang";

type IssueParams = Record<string, string | number> | undefined;

type Dictionary = {
  tagline: string;
  headline: string[];
  subheadline: string;
  analyzeLabel: string;
  urlPlaceholder: string;
  runButton: string;
  privacyNote: string;
  loadingSubtitle: string;
  startingAnalysis: string;
  verifying: (category: string) => string;
  checkDone: (category: string) => string;
  scoreLabelOk: string;
  scoreLabelAttention: string;
  categories: Record<"performance" | "seo" | "accessibility" | "security", string>;
  severity: Record<Severity, string>;
  whatWeFound: string;
  points: (count: number) => string;
  noIssues: string;
  showMore: (count: number) => string;
  nextStepButton: string;
  nextStepKicker: string;
  nextStepHeadline: string;
  nextStepBodyTwo: string;
  nextStepBodyFew: string;
  contactIntro: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  sendButton: string;
  sending: string;
  sendSuccess: string;
  sendError: string;
  formNotConfigured: string;
  reportFooter: (domain: string) => string;
  errorGeneric: string;
  errorInvalidUrl: string;
  errorMissingUrl: string;
  issue: Record<IssueCode, (params: IssueParams) => { title: string; description: string }>;
};

const pt: Dictionary = {
  tagline: "ferramenta de diagnóstico",
  headline: ["Todo site tem", "um ponto fraco."],
  subheadline:
    "A gente encontra o seu em menos de um minuto: performance, SEO, acessibilidade e segurança, tudo junto.",
  analyzeLabel: "Analisar",
  urlPlaceholder: "suasite.com.br",
  runButton: "Rodar diagnóstico",
  privacyNote: "Não guardamos a URL nem o relatório depois. Roda, mostra, some.",
  loadingSubtitle: "Isso leva menos de um minuto, e são checagens de verdade rodando, não é decoração.",
  startingAnalysis: "Iniciando análise…",
  verifying: (category) => `Verificando ${category}…`,
  checkDone: (category) => `Checagem de ${category} concluída.`,
  scoreLabelOk: "Está bem",
  scoreLabelAttention: "Precisa de atenção",
  categories: {
    performance: "Performance",
    seo: "SEO",
    accessibility: "Acessibilidade",
    security: "Segurança",
  },
  severity: { critico: "crítico", atencao: "atenção", ok: "ok" },
  whatWeFound: "O que encontramos",
  points: (count) => `${count} ${count === 1 ? "ponto" : "pontos"}`,
  noIssues: "Não encontramos problema nenhum nas checagens que rodamos.",
  showMore: (count) => `Mostrar mais ${count} ${count === 1 ? "problema" : "problemas"} ⌄`,
  nextStepButton: "Ver próximo passo →",
  nextStepKicker: "Próximo passo",
  nextStepHeadline: "O relatório aponta. Resolver é outra etapa.",
  nextStepBodyTwo: "Se dois desses pontos já tão custando venda, vale mexer neles antes do resto.",
  nextStepBodyFew: "É por aqui que vale começar.",
  contactIntro: "Se quiser ajuda com isso:",
  nameLabel: "Nome",
  namePlaceholder: "Seu nome",
  emailLabel: "E-mail",
  emailPlaceholder: "voce@email.com",
  messageLabel: "Mensagem",
  messagePlaceholder: "Conte um pouco sobre o que precisa",
  sendButton: "Enviar",
  sending: "Enviando…",
  sendSuccess: "Recebido. Volto pra você em breve.",
  sendError: "Não foi possível enviar. Tenta de novo em instantes.",
  formNotConfigured: "Formulário não configurado.",
  reportFooter: (domain) => `Isdias.dev · relatório referente a ${domain}`,
  errorGeneric: "Erro ao analisar o site.",
  errorInvalidUrl: "URL inválida.",
  errorMissingUrl: "Informe uma URL.",
  issue: {
    "no-https": () => ({
      title: "O site não é servido em HTTPS.",
      description: "Navegadores marcam a conexão como não segura, e isso afasta visitante e cliente.",
    }),
    "no-title": () => ({
      title: "A página não tem título.",
      description: "O Google não sabe do que o site trata.",
    }),
    "generic-title": (params) => ({
      title: `O título da home é só "${params?.title}".`,
      description: "O Google não sabe do que o site trata.",
    }),
    "no-description": () => ({
      title: "Falta a meta description.",
      description: "É o texto que aparece embaixo do link nos resultados de busca.",
    }),
    "no-viewport": () => ({
      title: "Falta a meta tag de viewport.",
      description: "Em celular, a página pode aparecer minúscula ou exigir zoom pra ler.",
    }),
    "missing-alt": (params) => ({
      title: `${params?.missing} de ${params?.sampled} imagens sem texto alternativo.`,
      description: "Quem usa leitor de tela não sabe o que essas imagens mostram.",
    }),
    "no-sitemap": () => ({
      title: "Não encontramos um sitemap.xml.",
      description: "Ajuda o Google a achar todas as páginas do site, principalmente as mais novas.",
    }),
    "low-performance": (params) => ({
      title: `Performance em ${params?.score}/100 no Lighthouse.`,
      description: "Tempo de sobra pra alguém desistir de esperar a página carregar.",
    }),
  },
};

const en: Dictionary = {
  tagline: "diagnostic tool",
  headline: ["Every site has", "a weak spot."],
  subheadline: "We find yours in under a minute: performance, SEO, accessibility and security, all at once.",
  analyzeLabel: "Analyze",
  urlPlaceholder: "yoursite.com",
  runButton: "Run diagnosis",
  privacyNote: "We don't keep the URL or the report afterward. It runs, it shows, it's gone.",
  loadingSubtitle: "This takes under a minute, and these are real checks running, not decoration.",
  startingAnalysis: "Starting analysis…",
  verifying: (category) => `Checking ${category}…`,
  checkDone: (category) => `${category} check complete.`,
  scoreLabelOk: "Looking good",
  scoreLabelAttention: "Needs attention",
  categories: {
    performance: "Performance",
    seo: "SEO",
    accessibility: "Accessibility",
    security: "Security",
  },
  severity: { critico: "critical", atencao: "attention", ok: "ok" },
  whatWeFound: "What we found",
  points: (count) => `${count} ${count === 1 ? "point" : "points"}`,
  noIssues: "We didn't find any problems in the checks we ran.",
  showMore: (count) => `Show ${count} more ${count === 1 ? "problem" : "problems"} ⌄`,
  nextStepButton: "See next step →",
  nextStepKicker: "Next step",
  nextStepHeadline: "The report points it out. Fixing it is a separate step.",
  nextStepBodyTwo: "If two of these are already costing you sales, worth tackling them before the rest.",
  nextStepBodyFew: "This is where it's worth starting.",
  contactIntro: "If you'd like help with this:",
  nameLabel: "Name",
  namePlaceholder: "Your name",
  emailLabel: "Email",
  emailPlaceholder: "you@email.com",
  messageLabel: "Message",
  messagePlaceholder: "Tell us a bit about what you need",
  sendButton: "Send",
  sending: "Sending…",
  sendSuccess: "Got it. I'll get back to you soon.",
  sendError: "Couldn't send it. Try again in a moment.",
  formNotConfigured: "Form not configured.",
  reportFooter: (domain) => `Isdias.dev · report for ${domain}`,
  errorGeneric: "Error analyzing the site.",
  errorInvalidUrl: "Invalid URL.",
  errorMissingUrl: "Enter a URL.",
  issue: {
    "no-https": () => ({
      title: "The site isn't served over HTTPS.",
      description: "Browsers flag the connection as not secure, which drives visitors and customers away.",
    }),
    "no-title": () => ({
      title: "The page has no title.",
      description: "Google doesn't know what the site is about.",
    }),
    "generic-title": (params) => ({
      title: `The homepage title is just "${params?.title}".`,
      description: "Google doesn't know what the site is about.",
    }),
    "no-description": () => ({
      title: "Missing the meta description.",
      description: "That's the text that shows up under the link in search results.",
    }),
    "no-viewport": () => ({
      title: "Missing the viewport meta tag.",
      description: "On mobile, the page can show up tiny or require zooming to read.",
    }),
    "missing-alt": (params) => ({
      title: `${params?.missing} of ${params?.sampled} images with no alt text.`,
      description: "Screen reader users have no idea what these images show.",
    }),
    "no-sitemap": () => ({
      title: "We couldn't find a sitemap.xml.",
      description: "It helps Google find every page on the site, especially the newer ones.",
    }),
    "low-performance": (params) => ({
      title: `Performance at ${params?.score}/100 on Lighthouse.`,
      description: "Plenty of time for someone to give up waiting for the page to load.",
    }),
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { pt, en };

export function translateIssue(
  locale: Locale,
  code: IssueCode,
  params: IssueParams,
): { title: string; description: string } {
  return DICTIONARIES[locale].issue[code](params);
}

export type { Dictionary };
export type CategoryKey = keyof Dictionary["categories"];
export type { IssueCategory };
