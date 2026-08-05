import type { Issue, IssueCategory, IssueCode } from "@/lib/issues";
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
  sent: string;
  sendSuccess: string;
  sendError: string;
  formNotConfigured: string;
  reportFooter: (domain: string) => string;
  errorGeneric: string;
  errorInvalidUrl: string;
  errorMissingUrl: string;
  issue: Record<IssueCode, (params: IssueParams) => { title: string; description: string }>;
  // Plain-language "so what" for a non-technical site owner, one level
  // removed from the technical finding above it — filled in one check
  // module at a time (see lib/checks/), so Partial rather than a full
  // Record. Not rendered per-item in the UI; it's source material a
  // future detail view could use directly.
  impact: Partial<Record<IssueCode, string>>;
  // Short noun-phrase version of the same idea, grammatically built to
  // slot into synthesizeImpact() below (e.g. "the insecure connection").
  impactClause: Partial<Record<IssueCode, string>>;
  // Turns 1-2 clauses from impactClause into the one summary sentence
  // shown before the contact form — kept as a per-locale function
  // (not shared string-building code) since the joining word ("e" vs
  // "and") and verb agreement differ by language.
  synthesizeImpact: (clauses: string[]) => string;
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
  severity: { critico: "crítico", atencao: "atenção", ok: "ok", indisponivel: "não avaliado" },
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
  sent: "Enviado",
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
    "invalid-certificate": () => ({
      title: "O certificado de segurança do site está incompleto.",
      description: "O servidor não envia a cadeia de certificado completa. Navegadores costumam corrigir isso sozinhos e esconder o problema, mas é uma falha real de configuração.",
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
    "slow-load-impact": (params) => ({
      title: `O site demora ${String(params?.seconds).replace(".", ",")}s pra carregar.`,
      description: `Nessa faixa, a chance de o visitante desistir antes da página carregar é pelo menos ${params?.bounceIncreasePercent}% maior.`,
    }),
  },
  impact: {
    "no-https": "Seu site aparece com o aviso \"não seguro\" no navegador do visitante. Isso passa desconfiança, principalmente se a pessoa for preencher algum formulário ou fazer uma compra.",
    "invalid-certificate": "O certificado de segurança do site tem um problema de configuração. Na maioria dos navegadores isso passa despercebido, mas em alguns aparelhos, apps ou navegadores mais rigorosos o site pode aparecer com alerta de segurança.",
  },
  impactClause: {
    "no-https": "a insegurança da conexão",
    "invalid-certificate": "o problema no certificado de segurança",
  },
  synthesizeImpact: (clauses) => {
    const joined = clauses.length > 1 ? `${clauses[0]} e ${clauses[1]}` : clauses[0];
    const verb = clauses.length > 1 ? "são" : "é";
    return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} ${verb} o que mais pesa contra o site agora, vale resolver antes do resto.`;
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
  severity: { critico: "critical", atencao: "attention", ok: "ok", indisponivel: "not evaluated" },
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
  sent: "Sent",
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
    "invalid-certificate": () => ({
      title: "The site's security certificate is incomplete.",
      description: "The server isn't sending the full certificate chain. Browsers often patch this over and hide the problem, but it's a real configuration issue.",
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
    "slow-load-impact": (params) => ({
      title: `The site takes ${params?.seconds}s to load.`,
      description: `At that speed, the visitor's chance of leaving before the page loads is at least ${params?.bounceIncreasePercent}% higher.`,
    }),
  },
  impact: {
    "no-https": "Your site shows up with a \"not secure\" warning in the visitor's browser. That reads as suspicious, especially if someone's about to fill out a form or make a purchase.",
    "invalid-certificate": "The site's security certificate has a configuration problem. Most browsers quietly work around it, but on some devices, apps, or stricter browsers the site can show up with a security warning instead.",
  },
  impactClause: {
    "no-https": "the insecure connection",
    "invalid-certificate": "the security certificate problem",
  },
  synthesizeImpact: (clauses) => {
    const joined = clauses.length > 1 ? `${clauses[0]} and ${clauses[1]}` : clauses[0];
    const verb = clauses.length > 1 ? "are" : "is";
    return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} ${verb} what's weighing the site down the most right now, worth fixing before anything else.`;
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { pt, en };

export function translateIssue(
  locale: Locale,
  code: IssueCode,
  params: IssueParams,
): { title: string; description: string } {
  // The Record<IssueCode, ...> type guarantees every *known* code is
  // covered at compile time, but a report can outlive the code that
  // produced it — one served from cache, or from a client bundle a
  // version behind the server — so a code the running dictionary
  // doesn't recognize is a real runtime possibility, not just a
  // hypothetical. Without this, that crashes the whole issue list
  // instead of just skipping the one finding it can't render.
  const entry = DICTIONARIES[locale].issue[code];
  if (!entry) return { title: code, description: "" };
  return entry(params);
}

export function translateImpact(locale: Locale, code: IssueCode): string | undefined {
  return DICTIONARIES[locale].impact[code];
}

/**
 * Combines the critical findings from a report into one short summary
 * sentence for the "why fix this" spot right before the contact form —
 * not a per-item explanation, a synthesis. Picks the first 1-2 findings
 * that have a clause defined (in the order deriveIssues() pushed them,
 * which already runs security first) and hands them to the locale's
 * own sentence-builder, since word order and verb agreement aren't
 * portable across languages. Returns null when there's nothing to
 * summarize (no critical findings, or none with a clause yet).
 */
export function synthesizeCriticalImpact(locale: Locale, criticalIssues: Issue[]): string | null {
  const dictionary = DICTIONARIES[locale];
  const clauses = criticalIssues
    .map((issue) => dictionary.impactClause[issue.code])
    .filter((clause): clause is string => Boolean(clause))
    .slice(0, 2);

  return clauses.length > 0 ? dictionary.synthesizeImpact(clauses) : null;
}

export type { Dictionary };
export type CategoryKey = keyof Dictionary["categories"];
export type { IssueCategory };
