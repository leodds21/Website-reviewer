import type { Issue, IssueCode, IssueSeverity } from "@/lib/issues";
import type { Severity } from "@/lib/score";
import type { AnalyzeError, AnalyzeErrorCode } from "@/lib/analyzeError";
import type { ContactErrorCode } from "@/app/hooks/useContactForm";
import type { FailureReason } from "@/lib/checkFailure";

/**
 * Turns a raw retry delay into something a person would actually say —
 * "43 minutos", not "2589 segundos". Rounds up so the stated time is
 * never optimistic: telling someone to come back sooner than they can
 * is worse than telling them to wait slightly longer.
 */
function formatWait(seconds: number, locale: Locale): string {
  if (seconds < 60) {
    const value = Math.max(1, Math.ceil(seconds));
    if (locale === "en") return `${value} second${value === 1 ? "" : "s"}`;
    return `${value} segundo${value === 1 ? "" : "s"}`;
  }

  const minutes = Math.ceil(seconds / 60);
  if (locale === "en") return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes} minuto${minutes === 1 ? "" : "s"}`;
}

export type Locale = "pt" | "en";

export const LOCALE_STORAGE_KEY = "isdias-lang";

type IssueParams = Record<string, string | number> | undefined;

type Dictionary = {
  documentTitle: string;
  tagline: string;
  headline: string[];
  subheadline: string;
  analyzeLabel: string;
  urlPlaceholder: string;
  runButton: string;
  privacyNote: string;
  privacyLinkLabel: string;
  close: string;
  privacyPolicy: {
    title: string;
    sections: { label: string; text: string }[];
  };
  loadingKicker: string;
  loadingHeadline: string;
  loadingSubtitle: string;
  loadingSteps: {
    validating: string;
    performance: string;
    seo: string;
    accessibility: string;
    security: string;
    finishing: string;
  };
  scoreLabelOk: string;
  scoreLabelAttention: string;
  scoreExplanationToggle: string;
  scoreExplanation: string;
  categories: Record<"performance" | "seo" | "accessibility" | "security", string>;
  // Category states and finding severities share one label set.
  severity: Record<Severity | IssueSeverity, string>;
  // Shown under a category that couldn't be measured, so the visitor
  // always learns why (and whether trying again could help) instead of
  // a bare "não medido".
  unavailableReason: Record<FailureReason, string>;
  partialMeasure: string;
  coverageNote: (measured: number) => string;
  // Neutral note + manual-analysis offer for a site that refused our
  // automated checks: a dead end turned into a next step.
  blockedNote: string;
  manualAnalysisButton: string;
  manualKicker: string;
  manualHeadline: string;
  manualBody: string;
  manualMessagePrefill: (domain: string) => string;
  whatWeFound: string;
  points: (count: number) => string;
  noIssues: string;
  showAllPoints: (count: number) => string;
  showLess: string;
  nextStepButton: string;
  nextStepKicker: string;
  nextStepHeadline: string;
  nextStepBody: string;
  recommendationsHeading: string;
  contactHeading: string;
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
  sendSuccessDetail: (email: string) => string;
  contactError: Record<ContactErrorCode, string>;
  reportHeading: (domain: string) => string;
  reportFooter: (domain: string) => string;
  // Neutral fact, not a finding — platformName is a proper noun
  // (WordPress, Wix...) so it's the same string in every locale; only
  // the sentence around it is translated.
  platformDetected: (platformName: string) => string;
  madeByLabel: string;
  opensNewTab: string;
  // One entry per AnalyzeErrorCode: every way an analysis can fail has
  // its own wording, so the visitor is never told "something went
  // wrong" when we know exactly what went wrong. `retryAfterSeconds`
  // is only ever present on rate-limited.
  analysisError: Record<AnalyzeErrorCode, (retryAfterSeconds?: number) => string>;
  issue: Record<IssueCode, (params: IssueParams) => { title: string; description: string }>;
  // Short noun-phrase version of the same idea, grammatically built to
  // slot into synthesizeImpact() below (e.g. "the insecure connection").
  impactClause: Partial<Record<IssueCode, string>>;
  // Turns 1-2 clauses from impactClause into the one summary sentence
  // shown before the contact form — kept as a per-locale function
  // (not shared string-building code) since the joining word ("e" vs
  // "and") and verb agreement differ by language.
  synthesizeImpact: (clauses: string[]) => string;
  // Objective, technically-grounded action for each finding, shown in
  // the "O que pode ser feito" step — deliberately never promises a
  // result (more sales, a fixed ranking) or claims the problem is
  // costing anything measurable, only describes what fixing it
  // involves. Filled for every IssueCode, not incrementally like
  // impactClause, since a finding with no recommendation would
  // leave a visible gap in that screen.
  recommendation: Record<IssueCode, string>;
};

const pt: Dictionary = {
  documentTitle: "lsdias.dev, diagnóstico de site",
  tagline: "ferramenta de diagnóstico",
  headline: ["Todo site tem", "um ponto fraco."],
  subheadline:
    "A gente encontra o seu em menos de um minuto: performance, SEO, acessibilidade e segurança, tudo junto.",
  analyzeLabel: "Analisar",
  urlPlaceholder: "seusite.com.br",
  runButton: "Rodar diagnóstico",
  privacyNote: "O relatório fica em cache por até 6 horas e depois é descartado. Alguns serviços técnicos processam os dados nesse meio-tempo.",
  privacyLinkLabel: "Como tratamos seus dados",
  close: "Fechar",
  privacyPolicy: {
    title: "Como tratamos seus dados",
    sections: [
      {
        label: "O que coletamos",
        text: "A URL que você analisa. Se você usar o formulário de contato, também seu nome, e-mail e mensagem.",
      },
      {
        label: "Com quem compartilhamos",
        text: "A URL vai para a API do Google PageSpeed Insights, que gera parte do relatório. Os dados do formulário de contato vão para o Formspree, que os encaminha pro nosso e-mail.",
      },
      {
        label: "Por quanto tempo guardamos",
        text: "O relatório fica em cache por até 6 horas e depois é descartado. Não guardamos os dados do formulário em nenhum banco de dados próprio.",
      },
      {
        label: "Rastreamento",
        text: "Não usamos ferramentas de analytics. O único cookie guarda o idioma que você escolheu. Seu IP só é usado, de forma temporária, pra limitar abusos, e não fica associado a você.",
      },
    ],
  },
  loadingKicker: "Analisando",
  loadingHeadline: "Rodando as checagens.",
  loadingSubtitle: "Isso leva menos de um minuto, e são checagens de verdade rodando, não é decoração.",
  loadingSteps: {
    validating: "Validando endereço",
    performance: "Testando desempenho",
    seo: "Verificando SEO",
    accessibility: "Analisando acessibilidade",
    security: "Conferindo segurança",
    finishing: "Preparando relatório",
  },
  scoreLabelOk: "Está bem",
  scoreLabelAttention: "Precisa de atenção",
  scoreExplanationToggle: "Como calculamos esta nota",
  scoreExplanation:
    "A nota geral é a média simples das quatro categorias, sem nenhuma valer mais que a outra. Cada categoria junta a medição do Google com as nossas checagens, e só os pontos marcados como crítico ou atenção tiram nota: sugestões aparecem na lista, mas não mudam o número. Uma categoria \"não medido\" fica fora da conta e mostra o motivo; nesse caso, a nota geral avisa em quantas categorias se baseia. \"Medido em parte\" quer dizer que algumas checagens daquela categoria não conseguiram rodar.",
  categories: {
    performance: "Performance",
    seo: "SEO",
    accessibility: "Acessibilidade",
    security: "Segurança",
  },
  severity: { critico: "crítico", atencao: "atenção", sugestao: "sugestão", ok: "ok", indisponivel: "não medido" },
  unavailableReason: {
    blocked: "O site recusou nosso acesso automático.",
    timeout: "A medição demorou demais. Vale tentar de novo.",
    unreachable: "Não conseguimos chegar até o site.",
    "site-error": "O site respondeu com uma página de erro.",
    quota: "Limite diário de medições atingido. Tenta de novo amanhã.",
    "measurement-failed": "O Google não conseguiu medir esta parte. Vale tentar de novo.",
    unknown: "Não deu pra medir desta vez. Vale tentar de novo.",
  },
  partialMeasure: "medido em parte",
  coverageNote: (measured) =>
    `Nota baseada em ${measured} de 4 categorias. As outras não puderam ser medidas, veja o motivo abaixo.`,
  blockedNote:
    "Este site recusa ferramentas automáticas, por isso algumas partes não puderam ser medidas. Isso não quer dizer que ele tenha problema: muitos sites bloqueiam robôs por segurança.",
  manualAnalysisButton: "Pedir análise manual",
  manualKicker: "Análise manual",
  manualHeadline: "Dá pra olhar esse site de perto, sem depender de robô.",
  manualBody:
    "Como o site bloqueou a análise automática, posso revisar ele direto no navegador e te mandar o que encontrar.",
  manualMessagePrefill: (domain) => `Quero uma análise manual de ${domain}.`,
  whatWeFound: "O que encontramos",
  points: (count) => `${count} ${count === 1 ? "ponto" : "pontos"}`,
  noIssues: "Não encontramos problema nenhum nas checagens que rodamos.",
  showAllPoints: (count) => `Ver todos os ${count} ${count === 1 ? "ponto" : "pontos"} ↓`,
  showLess: "Mostrar menos ↑",
  nextStepButton: "Ver como corrigir →",
  nextStepKicker: "Próximo passo",
  nextStepHeadline: "O relatório mostra o problema. Agora, veja o que pode ser feito.",
  nextStepBody: "Nem todo problema tem o mesmo impacto. Estes são os que vale corrigir primeiro.",
  recommendationsHeading: "O que pode ser feito",
  contactHeading: "Quer que a gente cuide disso?",
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
  sendSuccessDetail: (email) => `A resposta vai pra ${email}.`,
  contactError: {
    offline: "Você parece estar sem conexão. Sua mensagem não foi enviada: confere a internet e tenta de novo.",
    timeout: "O envio demorou demais e foi interrompido. Sua mensagem não foi enviada, pode tentar de novo.",
    rejected: "Não conseguimos enviar sua mensagem. Confere se o e-mail está certo e tenta de novo.",
    "not-configured": "O formulário de contato está indisponível no momento. Tenta de novo mais tarde.",
    unknown: "Não foi possível enviar sua mensagem. Tenta de novo em instantes.",
  },
  reportHeading: (domain) => `Relatório de ${domain}`,
  reportFooter: (domain) => `lsdias.dev · relatório referente a ${domain}`,
  platformDetected: (platformName) => `Feito em ${platformName}`,
  madeByLabel: "Veja meu portfólio",
  opensNewTab: "abre em nova aba",
  analysisError: {
    "missing-url": () => "Informe o endereço de um site pra analisar.",
    "invalid-url": () => "Esse endereço não parece válido. Confere se está escrito certo, tipo seusite.com.br.",
    "blocked-url": () => "Só dá pra analisar sites públicos na internet, não endereços internos ou locais.",
    "rate-limited": (seconds) =>
      seconds
        ? `Você fez muitas análises em pouco tempo. Tenta de novo em ${formatWait(seconds, "pt")}.`
        : "Você fez muitas análises em pouco tempo. Tenta de novo mais tarde.",
    "analysis-failed": () =>
      "Não conseguimos acessar esse site. Ele pode estar fora do ar, bloqueando ferramentas de análise, ou o endereço pode estar errado.",
    "site-blocked": () =>
      "Esse site recusa ferramentas automáticas de análise, então não deu pra medir nada daqui. Isso não quer dizer que ele tenha problema.",
    "site-unreachable": () =>
      "Não conseguimos chegar até esse site. Confere se o endereço está certo e se ele está no ar.",
    "quota-exceeded": () => "Atingimos o limite diário da ferramenta de análise. Tenta de novo amanhã.",
    timeout: () => "O site demorou demais pra responder e desistimos de esperar. Tenta de novo em instantes.",
    offline: () => "Você parece estar sem conexão. Confere sua internet e tenta de novo.",
    unknown: () => "Não conseguimos concluir a análise. Tenta de novo em instantes.",
  },
  issue: {
    "no-https": () => ({
      title: "O site não é servido em HTTPS.",
      description: "Navegadores marcam a conexão como não segura, e isso afasta visitante e cliente.",
    }),
    "invalid-certificate": () => ({
      title: "O certificado de segurança do site não é confiável.",
      description: "Ele pode estar vencido, ser autoassinado ou estar incompleto. Dependendo do navegador ou do app, o visitante vê um alerta de segurança ou nem consegue entrar.",
    }),
    "no-hsts": () => ({
      title: "O site não usa HSTS.",
      description: "Sem esse cabeçalho, o navegador não força HTTPS automaticamente nas próximas visitas, deixando uma brecha na primeira conexão.",
    }),
    "no-csp": () => ({
      title: "Falta o cabeçalho Content-Security-Policy.",
      description: "Esse cabeçalho ajuda a bloquear scripts maliciosos injetados na página. Sem ele, o site fica mais exposto a esse tipo de ataque.",
    }),
    "no-clickjacking-protection": () => ({
      title: "O site não tem proteção contra clickjacking.",
      description: "Sem essa proteção, outro site pode embutir o seu numa camada invisível e enganar o visitante a clicar em algo sem perceber.",
    }),
    "no-title": () => ({
      title: "A página não tem título.",
      description: "A aba do navegador e o resultado no Google mostram só o endereço, sem dizer o que o site oferece.",
    }),
    "generic-title": (params) => ({
      title: `O título da home é só "${params?.title}".`,
      description: "É esse título que aparece no Google, e um termo genérico não dá motivo pra alguém escolher esse resultado.",
    }),
    "no-description": () => ({
      title: "Falta a meta description.",
      description: "Sem ela, o Google escolhe sozinho o trecho que aparece embaixo do link nos resultados de busca.",
    }),
    "no-viewport": () => ({
      title: "Falta a meta tag de viewport.",
      description: "Em celular, a página pode aparecer minúscula ou exigir zoom pra ler.",
    }),
    "missing-alt": (params) => ({
      title: params
        ? `${params.missing} de ${params.sampled} imagens sem texto alternativo.`
        : "Há imagens sem texto alternativo.",
      description: "Quem usa leitor de tela não sabe o que essas imagens mostram.",
    }),
    "no-sitemap": () => ({
      title: "Não encontramos um sitemap.xml.",
      description: "Ajuda o Google a achar todas as páginas do site, principalmente as mais novas.",
    }),
    "low-performance": (params) => ({
      title: `A página tirou ${params?.score} de 100 no teste de velocidade do Google.`,
      description: "Tempo de sobra pra alguém desistir de esperar a página carregar.",
    }),
    "slow-load-impact": (params) => ({
      title: `O site demora ${String(params?.seconds).replace(".", ",")}s pra carregar.`,
      description: `Nessa faixa, a chance de o visitante desistir antes da página carregar é pelo menos ${params?.bounceIncreasePercent}% maior.`,
    }),
    "layout-shift": (params) => ({
      title: `O site tem instabilidade visual no carregamento (CLS de ${String(params?.value).replace(".", ",")}).`,
      description: "Elementos da página se deslocam depois de carregados, o que pode fazer a pessoa clicar no lugar errado sem querer.",
    }),
    "color-contrast": () => ({
      title: "Encontramos texto com contraste insuficiente.",
      description: "Algum texto do site é difícil de ler por causa do contraste de cor entre o texto e o fundo.",
    }),
    "slow-server-response": (params) => ({
      title: `O servidor demora ${params?.ms}ms pra começar a responder.`,
      description: "É o tempo até o primeiro byte da resposta chegar, antes do navegador ter qualquer HTML pra processar.",
    }),
    "heading-order": () => ({
      title: "Os títulos da página (H1, H2, H3...) não seguem uma ordem lógica.",
      description: "Pular níveis de título atrapalha quem usa leitor de tela a entender a estrutura da página.",
    }),
    "missing-form-labels": () => ({
      title: "Encontramos campo de formulário sem rótulo (label) associado.",
      description: "Sem um rótulo, quem usa leitor de tela não sabe o que preencher em cada campo.",
    }),
    "broken-links": (params) => ({
      title: `${params?.broken} de ${params?.checked} links testados na home estão quebrados.`,
      description: "Um link quebrado é um beco sem saída pra quem clicou, e um sinal ruim pro Google sobre a manutenção do site.",
    }),
  },
  impactClause: {
    "no-https": "a insegurança da conexão",
    "invalid-certificate": "o problema no certificado de segurança",
    // Only codes deriveIssues can mark critical have a clause:
    // synthesizeCriticalImpact reads nothing else.
    "no-title": "a falta de um título que identifique o site nas buscas",
    "no-viewport": "a experiência ruim pra quem acessa pelo celular",
    "missing-alt": "as imagens sem descrição pra quem usa leitor de tela",
    "low-performance": "a lentidão geral do carregamento",
    "slow-load-impact": "o tempo de carregamento alto",
    "layout-shift": "a instabilidade visual durante o carregamento",
    "slow-server-response": "o tempo de resposta lento do servidor",
    "broken-links": "os links quebrados na home",
  },
  synthesizeImpact: (clauses) => {
    const joined = clauses.length > 1 ? `${clauses[0]} e ${clauses[1]}` : clauses[0];
    const verb = clauses.length > 1 ? "são" : "é";
    return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} ${verb} o que mais pesa contra o site agora, vale resolver antes do resto.`;
  },
  recommendation: {
    "no-https": "Ativar um certificado HTTPS válido e configurar o servidor pra redirecionar automaticamente o tráfego de HTTP pra HTTPS.",
    "invalid-certificate": "Renovar ou reinstalar o certificado e conferir se o servidor envia a cadeia completa, com o certificado intermediário.",
    "no-hsts": "Adicionar o cabeçalho HSTS pra garantir que o navegador sempre use HTTPS nas próximas visitas.",
    "no-csp": "Configurar um cabeçalho Content-Security-Policy adequado ao site, restringindo de onde scripts podem ser carregados.",
    "no-clickjacking-protection": "Configurar proteção contra clickjacking e revisar os cabeçalhos de segurança.",
    "no-title": "Definir um título único pra cada página, descrevendo o que ela oferece.",
    "generic-title": "Reescrever o título da página com algo específico sobre o negócio, em vez de um termo genérico.",
    "no-description": "Criar uma meta description alinhada ao conteúdo da página e às buscas relevantes.",
    "no-viewport": "Adicionar a meta tag de viewport pra que a página se adapte corretamente a telas de celular.",
    "missing-alt": "Escrever uma descrição curta pra cada imagem que transmite informação, e usar alt=\"\" nas que são só decorativas.",
    "no-sitemap": "Gerar e publicar um sitemap.xml listando as páginas do site.",
    "low-performance": "Revisar o que mais pesa no carregamento, geralmente imagens grandes, scripts não usados ou fontes carregadas sem necessidade.",
    "slow-load-impact": "Priorizar o carregamento do conteúdo principal da página antes de qualquer coisa secundária.",
    "layout-shift": "Reservar o espaço de imagens, anúncios e blocos que carregam depois, pra eles não empurrarem o resto da página.",
    "color-contrast": "Ajustar as cores de texto e fundo pra aumentar o contraste nos trechos identificados.",
    "slow-server-response": "Investigar o que está lento no backend (banco de dados, processamento, hospedagem) ou considerar cache/CDN pra servir a resposta mais rápido.",
    "heading-order": "Reorganizar os títulos da página pra seguir uma hierarquia lógica (H1 seguido de H2, H2 seguido de H3, sem pular níveis).",
    "missing-form-labels": "Associar um <label> a cada campo de formulário, ou usar aria-label quando um rótulo visível não for possível.",
    "broken-links": "Corrigir ou remover os links quebrados encontrados, atualizando o destino ou apontando pra uma página que ainda existe.",
  },
};

const en: Dictionary = {
  documentTitle: "lsdias.dev, website diagnostics",
  tagline: "diagnostic tool",
  headline: ["Every site has", "a weak spot."],
  subheadline: "We find yours in under a minute: performance, SEO, accessibility and security, all at once.",
  analyzeLabel: "Analyze",
  urlPlaceholder: "yoursite.com",
  runButton: "Run diagnosis",
  privacyNote: "The report is cached for up to 6 hours and then discarded. Some technical services process the data in the meantime.",
  privacyLinkLabel: "How we handle your data",
  close: "Close",
  privacyPolicy: {
    title: "How we handle your data",
    sections: [
      {
        label: "What we collect",
        text: "The URL you analyze. If you use the contact form, also your name, email, and message.",
      },
      {
        label: "Who we share it with",
        text: "The URL goes to Google's PageSpeed Insights API, which generates part of the report. Contact form data goes to Formspree, which forwards it to our inbox.",
      },
      {
        label: "How long we keep it",
        text: "The report is cached for up to 6 hours, then discarded. We don't keep contact form data in any database of our own.",
      },
      {
        label: "Tracking",
        text: "We don't use analytics tools. The only cookie remembers the language you picked. Your IP is only used temporarily to limit abuse, and it isn't tied to your identity.",
      },
    ],
  },
  loadingKicker: "Analyzing",
  loadingHeadline: "Running the checks.",
  loadingSubtitle: "This takes under a minute, and these are real checks running, not decoration.",
  loadingSteps: {
    validating: "Validating address",
    performance: "Testing performance",
    seo: "Checking SEO",
    accessibility: "Analyzing accessibility",
    security: "Checking security",
    finishing: "Preparing report",
  },
  scoreLabelOk: "Looking good",
  scoreLabelAttention: "Needs attention",
  scoreExplanationToggle: "How we calculate this score",
  scoreExplanation:
    "The overall score is a simple average of the four categories, none weighted more than another. Each category combines Google's measurement with our own checks, and only findings marked critical or attention cost points: suggestions show up in the list but don't change the number. A category marked \"not measured\" is left out and shows the reason; when that happens, the overall score says how many categories it's based on. \"Partly measured\" means some of that category's checks couldn't run.",
  categories: {
    performance: "Performance",
    seo: "SEO",
    accessibility: "Accessibility",
    security: "Security",
  },
  severity: { critico: "critical", atencao: "attention", sugestao: "suggestion", ok: "ok", indisponivel: "not measured" },
  unavailableReason: {
    blocked: "The site refused our automated access.",
    timeout: "The measurement took too long. Worth trying again.",
    unreachable: "We couldn't reach the site.",
    "site-error": "The site answered with an error page.",
    quota: "Daily measurement limit reached. Try again tomorrow.",
    "measurement-failed": "Google couldn't measure this part. Worth trying again.",
    unknown: "We couldn't measure this time. Worth trying again.",
  },
  partialMeasure: "partly measured",
  coverageNote: (measured) =>
    `Score based on ${measured} of 4 categories. The others couldn't be measured, see why below.`,
  blockedNote:
    "This site refuses automated tools, so some parts couldn't be measured. That doesn't mean something is wrong with it: many sites block bots for security.",
  manualAnalysisButton: "Request a manual review",
  manualKicker: "Manual review",
  manualHeadline: "This site can be looked at up close, without relying on a bot.",
  manualBody: "Since the site blocked the automated analysis, I can review it directly in a browser and send you what I find.",
  manualMessagePrefill: (domain) => `I'd like a manual review of ${domain}.`,
  whatWeFound: "What we found",
  points: (count) => `${count} ${count === 1 ? "point" : "points"}`,
  noIssues: "We didn't find any problems in the checks we ran.",
  showAllPoints: (count) => `See all ${count} ${count === 1 ? "point" : "points"} ↓`,
  showLess: "Show less ↑",
  nextStepButton: "See how to fix it →",
  nextStepKicker: "Next step",
  nextStepHeadline: "The report shows the problem. Now, here's what can be done.",
  nextStepBody: "Not every problem has the same impact. These are the ones worth fixing first.",
  recommendationsHeading: "What can be done",
  contactHeading: "Want us to take care of it?",
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
  sendSuccessDetail: (email) => `The reply will go to ${email}.`,
  contactError: {
    offline: "You appear to be offline. Your message wasn't sent: check your connection and try again.",
    timeout: "Sending took too long and was interrupted. Your message wasn't sent, feel free to try again.",
    rejected: "We couldn't send your message. Check that the email address is correct and try again.",
    "not-configured": "The contact form is unavailable right now. Please try again later.",
    unknown: "We couldn't send your message. Try again in a moment.",
  },
  reportHeading: (domain) => `Report for ${domain}`,
  reportFooter: (domain) => `lsdias.dev · report for ${domain}`,
  platformDetected: (platformName) => `Built on ${platformName}`,
  madeByLabel: "See my portfolio",
  opensNewTab: "opens in a new tab",
  analysisError: {
    "missing-url": () => "Enter the address of a site to analyze.",
    "invalid-url": () => "That address doesn't look valid. Check the spelling, something like yoursite.com.",
    "blocked-url": () => "We can only analyze public sites on the internet, not internal or local addresses.",
    "rate-limited": (seconds) =>
      seconds
        ? `You've run a lot of analyses in a short time. Try again in ${formatWait(seconds, "en")}.`
        : "You've run a lot of analyses in a short time. Try again later.",
    "analysis-failed": () =>
      "We couldn't reach that site. It may be down, blocking analysis tools, or the address may be wrong.",
    "site-blocked": () =>
      "This site refuses automated analysis tools, so we couldn't measure anything from here. That doesn't mean something is wrong with it.",
    "site-unreachable": () => "We couldn't reach this site. Check that the address is right and that the site is up.",
    "quota-exceeded": () => "We've hit the analysis tool's daily limit. Try again tomorrow.",
    timeout: () => "The site took too long to respond and we stopped waiting. Try again in a moment.",
    offline: () => "You appear to be offline. Check your connection and try again.",
    unknown: () => "We couldn't finish the analysis. Try again in a moment.",
  },
  issue: {
    "no-https": () => ({
      title: "The site isn't served over HTTPS.",
      description: "Browsers flag the connection as not secure, which drives visitors and customers away.",
    }),
    "invalid-certificate": () => ({
      title: "The site's security certificate isn't trusted.",
      description: "It may be expired, self-signed or incomplete. Depending on the browser or app, visitors see a security warning or can't get in at all.",
    }),
    "no-hsts": () => ({
      title: "The site doesn't use HSTS.",
      description: "Without this header, the browser won't automatically force HTTPS on future visits, leaving a gap on the very first connection.",
    }),
    "no-csp": () => ({
      title: "Missing the Content-Security-Policy header.",
      description: "This header helps block malicious scripts injected into the page. Without it, the site is more exposed to that kind of attack.",
    }),
    "no-clickjacking-protection": () => ({
      title: "The site has no clickjacking protection.",
      description: "Without it, another site can embed yours in an invisible layer and trick a visitor into clicking something without realizing it.",
    }),
    "no-title": () => ({
      title: "The page has no title.",
      description: "The browser tab and the Google result show only the address, without saying what the site offers.",
    }),
    "generic-title": (params) => ({
      title: `The homepage title is just "${params?.title}".`,
      description: "That's the title Google shows, and a generic word gives nobody a reason to pick this result.",
    }),
    "no-description": () => ({
      title: "Missing the meta description.",
      description: "Without it, Google picks on its own which snippet shows under the link in search results.",
    }),
    "no-viewport": () => ({
      title: "Missing the viewport meta tag.",
      description: "On mobile, the page can show up tiny or require zooming to read.",
    }),
    "missing-alt": (params) => ({
      title: params
        ? `${params.missing} of ${params.sampled} images with no alt text.`
        : "Some images have no alt text.",
      description: "Screen reader users have no idea what these images show.",
    }),
    "no-sitemap": () => ({
      title: "We couldn't find a sitemap.xml.",
      description: "It helps Google find every page on the site, especially the newer ones.",
    }),
    "low-performance": (params) => ({
      title: `The page scored ${params?.score} out of 100 on Google's speed test.`,
      description: "Plenty of time for someone to give up waiting for the page to load.",
    }),
    "slow-load-impact": (params) => ({
      title: `The site takes ${params?.seconds}s to load.`,
      description: `At that speed, the visitor's chance of leaving before the page loads is at least ${params?.bounceIncreasePercent}% higher.`,
    }),
    "layout-shift": (params) => ({
      title: `The site has visual instability while loading (CLS of ${params?.value}).`,
      description: "Page elements shift around after loading, which can make someone click the wrong thing by accident.",
    }),
    "color-contrast": () => ({
      title: "We found text with insufficient contrast.",
      description: "Some text on the site is hard to read because of low color contrast between the text and the background.",
    }),
    "slow-server-response": (params) => ({
      title: `The server takes ${params?.ms}ms to start responding.`,
      description: "That's the time to the first byte of the response, before the browser has any HTML to work with.",
    }),
    "heading-order": () => ({
      title: "Heading levels (H1, H2, H3...) aren't in a logical order.",
      description: "Skipping heading levels makes it harder for screen reader users to understand the page's structure.",
    }),
    "missing-form-labels": () => ({
      title: "We found a form field with no associated label.",
      description: "Without a label, screen reader users don't know what to enter in each field.",
    }),
    "broken-links": (params) => ({
      title: `${params?.broken} of ${params?.checked} links tested on the homepage are broken.`,
      description: "A broken link is a dead end for whoever clicked it, and a bad signal to Google about how well-maintained the site is.",
    }),
  },
  impactClause: {
    "no-https": "the insecure connection",
    "invalid-certificate": "the security certificate problem",
    "no-title": "the missing page title that would identify the site in search",
    "no-viewport": "the broken experience for mobile visitors",
    "missing-alt": "images with no description for screen reader users",
    "low-performance": "the overall slow load time",
    "slow-load-impact": "the high load time",
    "layout-shift": "the visual instability while loading",
    "slow-server-response": "the slow server response time",
    "broken-links": "the broken links on the homepage",
  },
  synthesizeImpact: (clauses) => {
    const joined = clauses.length > 1 ? `${clauses[0]} and ${clauses[1]}` : clauses[0];
    const verb = clauses.length > 1 ? "are" : "is";
    return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} ${verb} what's weighing the site down the most right now, worth fixing before anything else.`;
  },
  recommendation: {
    "no-https": "Set up a valid HTTPS certificate and configure the server to automatically redirect HTTP traffic to HTTPS.",
    "invalid-certificate": "Renew or reinstall the certificate and make sure the server sends the full chain, including the intermediate certificate.",
    "no-hsts": "Add the HSTS header so the browser always uses HTTPS on future visits.",
    "no-csp": "Set up a Content-Security-Policy header suited to the site, restricting where scripts can be loaded from.",
    "no-clickjacking-protection": "Set up clickjacking protection and review the site's security headers.",
    "no-title": "Set a unique title for each page, describing what it offers.",
    "generic-title": "Rewrite the page title with something specific about the business, instead of a generic term.",
    "no-description": "Write a meta description aligned with the page's content and the searches that matter to it.",
    "no-viewport": "Add the viewport meta tag so the page adapts correctly to phone screens.",
    "missing-alt": "Write a short description for each image that carries information, and use alt=\"\" on purely decorative ones.",
    "no-sitemap": "Generate and publish a sitemap.xml listing the site's pages.",
    "low-performance": "Review what's weighing load time down the most: usually large images, unused scripts, or fonts loaded unnecessarily.",
    "slow-load-impact": "Prioritize loading the page's main content before anything secondary.",
    "layout-shift": "Reserve space for images, ads, and blocks that load later, so they don't push the rest of the page around.",
    "color-contrast": "Adjust text and background colors to increase contrast in the flagged areas.",
    "slow-server-response": "Investigate what's slow on the backend (database, processing, hosting) or consider caching/a CDN to serve the response faster.",
    "heading-order": "Reorganize the page's headings to follow a logical hierarchy (H1 followed by H2, H2 followed by H3, without skipping levels).",
    "missing-form-labels": "Associate a <label> with each form field, or use aria-label when a visible label isn't possible.",
    "broken-links": "Fix or remove the broken links found, updating the destination or pointing to a page that still exists.",
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

export function translateRecommendation(locale: Locale, code: IssueCode): string {
  return DICTIONARIES[locale].recommendation[code];
}

export function translateAnalysisError(locale: Locale, error: AnalyzeError): string {
  const dictionary = DICTIONARIES[locale].analysisError;
  // An unrecognized code can reach here from a server newer than the
  // loaded client bundle; falling back beats rendering "undefined".
  const entry = dictionary[error.code] ?? dictionary.unknown;
  return entry(error.retryAfterSeconds);
}

/**
 * Combines the critical findings from a report into one short summary
 * sentence for the "why fix this" spot right before the contact form —
 * not a per-item explanation, a synthesis. Picks the first 1-2 findings
 * that have a clause defined (in the order deriveIssues() pushed them,
 * which already runs security first), capped at one per category —
 * low-performance and slow-load-impact can both be critical at once
 * (same underlying pagespeed check), and pairing their clauses would
 * read as a redundant restatement rather than two distinct problems —
 * and hands them to the locale's own sentence-builder, since word
 * order and verb agreement aren't portable across languages. Returns
 * null when there's nothing to summarize (no critical findings, or
 * none with a clause yet).
 */
export function synthesizeCriticalImpact(locale: Locale, criticalIssues: Issue[]): string | null {
  const dictionary = DICTIONARIES[locale];
  const seenCategories = new Set<Issue["category"]>();

  const clauses = criticalIssues
    .filter((issue) => {
      if (seenCategories.has(issue.category)) return false;
      seenCategories.add(issue.category);
      return true;
    })
    .map((issue) => dictionary.impactClause[issue.code])
    .filter((clause): clause is string => Boolean(clause))
    .slice(0, 2);

  return clauses.length > 0 ? dictionary.synthesizeImpact(clauses) : null;
}

export type { Dictionary };
export type CategoryKey = keyof Dictionary["categories"];
