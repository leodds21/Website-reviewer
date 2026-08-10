import type { Issue, IssueCategory, IssueCode } from "@/lib/issues";
import type { Severity } from "@/lib/score";
import type { AnalyzeError, AnalyzeErrorCode } from "@/lib/analyzeError";
import type { ContactErrorCode } from "@/app/hooks/useContactForm";

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
  severity: Record<Severity, string>;
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
  madeByLabel: string;
  opensNewTab: string;
  // One entry per AnalyzeErrorCode: every way an analysis can fail has
  // its own wording, so the visitor is never told "something went
  // wrong" when we know exactly what went wrong. `retryAfterSeconds`
  // is only ever present on rate-limited.
  analysisError: Record<AnalyzeErrorCode, (retryAfterSeconds?: number) => string>;
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
  // Objective, technically-grounded action for each finding, shown in
  // the "O que pode ser feito" step — deliberately never promises a
  // result (more sales, a fixed ranking) or claims the problem is
  // costing anything measurable, only describes what fixing it
  // involves. Filled for every IssueCode, not incrementally like
  // impact/impactClause, since a finding with no recommendation would
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
  privacyNote: "Não armazenamos a URL nem o relatório após a análise. Alguns serviços técnicos podem processar dados temporariamente.",
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
        text: "Não usamos cookies nem ferramentas de analytics. Seu IP só é usado, de forma temporária, pra limitar abusos — não fica associado a você.",
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
    "A nota geral é a média simples das quatro categorias — Performance, SEO, Acessibilidade e Segurança — sem nenhuma valer mais que a outra. Cada categoria, por sua vez, já é a média das checagens que a compõem (Segurança, por exemplo, combina HTTPS, certificado e cabeçalhos de proteção). Uma categoria marcada \"não avaliado\" fica de fora da conta: normalmente é porque alguma checagem não conseguiu rodar, não porque está tudo bem por lá. \"Crítico\" e \"atenção\" indicam o quanto aquela categoria está abaixo do ideal; \"ok\" significa que não encontramos problema relevante nela.",
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
    offline: "Você parece estar sem conexão. Sua mensagem não foi enviada — confere a internet e tenta de novo.",
    timeout: "O envio demorou demais e foi interrompido. Sua mensagem não foi enviada, pode tentar de novo.",
    rejected: "Não conseguimos enviar sua mensagem. Confere se o e-mail está certo e tenta de novo.",
    "not-configured": "O formulário de contato está indisponível no momento. Tenta de novo mais tarde.",
    unknown: "Não foi possível enviar sua mensagem. Tenta de novo em instantes.",
  },
  reportHeading: (domain) => `Relatório de ${domain}`,
  reportFooter: (domain) => `lsdias.dev · relatório referente a ${domain}`,
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
    timeout: () => "O site demorou demais pra responder e desistimos de esperar. Tenta de novo em instantes.",
    offline: () => "Você parece estar sem conexão. Confere sua internet e tenta de novo.",
    unknown: () => "Algo deu errado no meio da análise. Tenta de novo em instantes.",
  },
  issue: {
    "no-https": () => ({
      title: "O site não é servido em HTTPS.",
      description: "Navegadores marcam a conexão como não segura, e isso afasta visitante e cliente.",
    }),
    "invalid-certificate": () => ({
      title: "O certificado de segurança do site está incompleto.",
      description: "O servidor não envia a cadeia de certificado completa. Navegadores costumam corrigir isso sozinhos e esconder o problema, mas é uma falha real de configuração.",
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
    "layout-shift": (params) => ({
      title: `O site tem instabilidade visual no carregamento (CLS de ${params?.value}).`,
      description: "Elementos da página se deslocam depois de carregados, o que pode fazer a pessoa clicar no lugar errado sem querer.",
    }),
    "color-contrast": () => ({
      title: "Encontramos texto com contraste insuficiente.",
      description: "Algum texto do site é difícil de ler por causa do contraste de cor entre o texto e o fundo.",
    }),
  },
  impact: {
    "no-https": "Seu site aparece com o aviso \"não seguro\" no navegador do visitante. Isso passa desconfiança, principalmente se a pessoa for preencher algum formulário ou fazer uma compra.",
    "invalid-certificate": "O certificado de segurança do site tem um problema de configuração. Na maioria dos navegadores isso passa despercebido, mas em alguns aparelhos, apps ou navegadores mais rigorosos o site pode aparecer com alerta de segurança.",
    "no-hsts": "Isso não deixa o site vulnerável de imediato, mas é uma camada de proteção a menos: sem ela, existe uma brecha pequena onde alguém na mesma rede do visitante (tipo um wifi público) poderia, em teoria, interceptar a primeira conexão antes dela virar HTTPS.",
    "no-csp": "Esse é um cabeçalho técnico que ajuda a impedir que um invasor injete código malicioso na sua página, por exemplo através de um formulário ou campo de comentário vulnerável. Sem ele, essa camada extra de defesa não existe.",
    "no-clickjacking-protection": "Sem essa proteção, é tecnicamente possível outro site \"vestir\" o seu por cima de uma página falsa, fazendo a pessoa pensar que está clicando numa coisa quando na verdade está clicando em outra.",
    "no-title": "A aba do navegador e os resultados de busca do Google mostram o site sem nenhum nome. Isso dificulta a pessoa reconhecer ou lembrar do site depois de encontrar num resultado de busca.",
    "generic-title": "O título que aparece no Google pra esse site é genérico demais (tipo \"Home\"), sem dizer nada sobre o que o negócio oferece. Quem está buscando não tem motivo pra escolher esse resultado em vez do concorrente.",
    "no-description": "Falta o textinho que aparece embaixo do link nos resultados do Google. Sem ele, o Google escolhe um trecho aleatório da página pra mostrar, o que deixa o resultado menos convidativo na hora de decidir em qual link clicar.",
    "no-viewport": "Em celular, a página pode aparecer minúscula, exigindo que a pessoa dê zoom pra ler qualquer coisa. A maior parte de quem acessa a internet hoje faz isso pelo celular, então essa experiência ruim atinge boa parte dos visitantes.",
    "missing-alt": "Sem a descrição alternativa, quem usa leitor de tela (pessoas com deficiência visual) não sabe o que aquelas imagens mostram — pra elas, é como se a imagem simplesmente não existisse. Também reduz a chance de essas imagens aparecerem nas buscas do Google.",
    "no-sitemap": "O sitemap é como um mapa que ajuda o Google a encontrar todas as páginas do site, principalmente as mais novas. Sem ele, uma página recém-publicada pode demorar bem mais pra aparecer nos resultados de busca.",
    "low-performance": "Quanto mais devagar o site carrega, maior a chance de a pessoa desistir antes mesmo de ver o conteúdo. Velocidade de carregamento também é um dos fatores que o Google leva em conta pra decidir a posição do site nas buscas.",
    // The seconds/percentage numbers are already shown in the
    // finding's own title/description (see LOAD_IMPACT_BUCKETS,
    // lib/issues.ts, cited from Google's CrUX-based analysis) — this
    // doesn't restate them, just confirms it's not a guess.
    "slow-load-impact": "Cada segundo a mais de espera aumenta a chance de a pessoa sair do site antes de ver qualquer coisa — o número acima não é uma estimativa aleatória, vem de uma pesquisa real sobre esse comportamento.",
    "layout-shift": "Isso costuma acontecer quando uma imagem, anúncio ou bloco de texto carrega depois e empurra o resto da página — o que já era clicável muda de lugar bem na hora em que a pessoa ia interagir.",
    "color-contrast": "Texto com pouco contraste é difícil de ler pra qualquer pessoa em ambiente claro ou com o brilho da tela baixo, e praticamente ilegível pra quem tem baixa visão.",
  },
  impactClause: {
    "no-https": "a insegurança da conexão",
    "invalid-certificate": "o problema no certificado de segurança",
    // no-hsts/no-csp/no-clickjacking-protection have no clause: all
    // three are always severity "atencao" (see deriveIssues), so they
    // can never reach the critical-only input synthesizeCriticalImpact
    // consumes — same reasoning as no-description/no-sitemap below.
    "no-title": "a falta de um título que identifique o site nas buscas",
    "generic-title": "um título genérico demais pra se destacar nas buscas",
    "no-viewport": "a experiência ruim pra quem acessa pelo celular",
    "missing-alt": "as imagens sem descrição pra quem usa leitor de tela",
    "low-performance": "a lentidão geral do carregamento",
    "slow-load-impact": "o tempo de carregamento alto",
    "layout-shift": "a instabilidade visual durante o carregamento",
    // color-contrast has no clause: always "atencao" (no per-element
    // ratio to grade severity by), same reasoning as no-sitemap below.
    // no-sitemap has no clause: it's always severity "atencao", never
    // "critico" (see deriveIssues), so it can never reach the
    // critical-only input synthesizeCriticalImpact consumes.
  },
  synthesizeImpact: (clauses) => {
    const joined = clauses.length > 1 ? `${clauses[0]} e ${clauses[1]}` : clauses[0];
    const verb = clauses.length > 1 ? "são" : "é";
    return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} ${verb} o que mais pesa contra o site agora, vale resolver antes do resto.`;
  },
  recommendation: {
    "no-https": "Ativar um certificado HTTPS válido e configurar o servidor pra redirecionar automaticamente o tráfego de HTTP pra HTTPS.",
    "invalid-certificate": "Corrigir a cadeia de certificado no servidor, incluindo o certificado intermediário que está faltando.",
    "no-hsts": "Adicionar o cabeçalho HSTS pra garantir que o navegador sempre use HTTPS nas próximas visitas.",
    "no-csp": "Configurar um cabeçalho Content-Security-Policy adequado ao site, restringindo de onde scripts podem ser carregados.",
    "no-clickjacking-protection": "Configurar proteção contra clickjacking e revisar os cabeçalhos de segurança.",
    "no-title": "Definir um título único pra cada página, descrevendo o que ela oferece.",
    "generic-title": "Reescrever o título da página com algo específico sobre o negócio, em vez de um termo genérico.",
    "no-description": "Criar uma meta description alinhada ao conteúdo da página e às buscas relevantes.",
    "no-viewport": "Adicionar a meta tag de viewport pra que a página se adapte corretamente a telas de celular.",
    "missing-alt": "Escrever uma descrição alternativa pra cada imagem relevante do site.",
    "no-sitemap": "Gerar e publicar um sitemap.xml listando as páginas do site.",
    "low-performance": "Revisar o que mais pesa no carregamento — geralmente imagens grandes, scripts não usados ou fontes carregadas sem necessidade.",
    "slow-load-impact": "Priorizar o carregamento do conteúdo principal da página antes de qualquer coisa secundária.",
    "layout-shift": "Reservar o espaço de imagens, anúncios e blocos que carregam depois, pra eles não empurrarem o resto da página.",
    "color-contrast": "Ajustar as cores de texto e fundo pra aumentar o contraste nos trechos identificados.",
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
  privacyNote: "We don't store the URL or the report after the analysis. Some technical services may process data temporarily.",
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
        text: "We don't use cookies or analytics tools. Your IP is only used temporarily to limit abuse — it isn't tied to your identity.",
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
    "The overall score is a simple average of the four categories — Performance, SEO, Accessibility, and Security — none weighted more than another. Each category is itself an average of the checks that make it up (Security, for instance, combines HTTPS, the certificate, and protection headers). A category marked \"not evaluated\" is left out of that average: usually because a check couldn't run, not because everything's fine there. \"Critical\" and \"attention\" show how far below ideal that category is; \"ok\" means we didn't find a relevant problem in it.",
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
    offline: "You appear to be offline. Your message wasn't sent — check your connection and try again.",
    timeout: "Sending took too long and was interrupted. Your message wasn't sent, feel free to try again.",
    rejected: "We couldn't send your message. Check that the email address is correct and try again.",
    "not-configured": "The contact form is unavailable right now. Please try again later.",
    unknown: "We couldn't send your message. Try again in a moment.",
  },
  reportHeading: (domain) => `Report for ${domain}`,
  reportFooter: (domain) => `lsdias.dev · report for ${domain}`,
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
    timeout: () => "The site took too long to respond and we stopped waiting. Try again in a moment.",
    offline: () => "You appear to be offline. Check your connection and try again.",
    unknown: () => "Something went wrong during the analysis. Try again in a moment.",
  },
  issue: {
    "no-https": () => ({
      title: "The site isn't served over HTTPS.",
      description: "Browsers flag the connection as not secure, which drives visitors and customers away.",
    }),
    "invalid-certificate": () => ({
      title: "The site's security certificate is incomplete.",
      description: "The server isn't sending the full certificate chain. Browsers often patch this over and hide the problem, but it's a real configuration issue.",
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
    "layout-shift": (params) => ({
      title: `The site has visual instability while loading (CLS of ${params?.value}).`,
      description: "Page elements shift around after loading, which can make someone click the wrong thing by accident.",
    }),
    "color-contrast": () => ({
      title: "We found text with insufficient contrast.",
      description: "Some text on the site is hard to read because of low color contrast between the text and the background.",
    }),
  },
  impact: {
    "no-https": "Your site shows up with a \"not secure\" warning in the visitor's browser. That reads as suspicious, especially if someone's about to fill out a form or make a purchase.",
    "invalid-certificate": "The site's security certificate has a configuration problem. Most browsers quietly work around it, but on some devices, apps, or stricter browsers the site can show up with a security warning instead.",
    "no-hsts": "This doesn't make the site immediately vulnerable, but it's one less layer of protection: without it, there's a small window where someone on the same network as the visitor (like public wifi) could, in theory, intercept that first connection before it becomes HTTPS.",
    "no-csp": "This is a technical header that helps stop an attacker from injecting malicious code into your page, for example through a vulnerable form or comment field. Without it, that extra layer of defense doesn't exist.",
    "no-clickjacking-protection": "Without this protection, it's technically possible for another site to overlay yours on top of a fake page, making someone think they're clicking one thing when they're actually clicking another.",
    "no-title": "The browser tab and Google's search results show the site with no name at all. That makes it harder for someone to recognize or remember the site after finding it in a search.",
    "generic-title": "The title that shows up on Google for this site is too generic (like \"Home\"), and says nothing about what the business actually offers. Someone searching has no reason to pick this result over a competitor's.",
    "no-description": "The short text that shows up under the link in Google's results is missing. Without it, Google picks a random snippet from the page instead, which makes the result less inviting when someone's deciding which link to click.",
    "no-viewport": "On mobile, the page can show up tiny, forcing people to zoom in just to read anything. Most people browse the internet from a phone these days, so this bad experience hits a large share of visitors.",
    "missing-alt": "Without alt text, screen reader users (people with visual impairments) have no idea what those images show — to them, it's as if the image simply isn't there. It also lowers the odds of those images showing up in Google search results.",
    "no-sitemap": "A sitemap is like a map that helps Google find every page on the site, especially the newest ones. Without it, a page you just published can take much longer to show up in search results.",
    "low-performance": "The slower a site loads, the more likely someone is to give up before even seeing the content. Load speed is also one of the factors Google weighs when deciding where the site ranks in search results.",
    "slow-load-impact": "Every extra second of waiting raises the odds someone leaves before seeing anything at all — the number above isn't a rough guess, it comes from real published research on this exact behavior.",
    "layout-shift": "This usually happens when an image, ad, or block of text loads late and pushes the rest of the page around — something that was already clickable moves right as someone's about to interact with it.",
    "color-contrast": "Low-contrast text is hard to read for anyone in a bright environment or with low screen brightness, and nearly unreadable for people with low vision.",
  },
  impactClause: {
    "no-https": "the insecure connection",
    "invalid-certificate": "the security certificate problem",
    "no-title": "the missing page title that would identify the site in search",
    "generic-title": "a page title too generic to stand out in search",
    "no-viewport": "the broken experience for mobile visitors",
    "missing-alt": "images with no description for screen reader users",
    "low-performance": "the overall slow load time",
    "slow-load-impact": "the high load time",
    "layout-shift": "the visual instability while loading",
  },
  synthesizeImpact: (clauses) => {
    const joined = clauses.length > 1 ? `${clauses[0]} and ${clauses[1]}` : clauses[0];
    const verb = clauses.length > 1 ? "are" : "is";
    return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} ${verb} what's weighing the site down the most right now, worth fixing before anything else.`;
  },
  recommendation: {
    "no-https": "Set up a valid HTTPS certificate and configure the server to automatically redirect HTTP traffic to HTTPS.",
    "invalid-certificate": "Fix the certificate chain on the server, including the missing intermediate certificate.",
    "no-hsts": "Add the HSTS header so the browser always uses HTTPS on future visits.",
    "no-csp": "Set up a Content-Security-Policy header suited to the site, restricting where scripts can be loaded from.",
    "no-clickjacking-protection": "Set up clickjacking protection and review the site's security headers.",
    "no-title": "Set a unique title for each page, describing what it offers.",
    "generic-title": "Rewrite the page title with something specific about the business, instead of a generic term.",
    "no-description": "Write a meta description aligned with the page's content and the searches that matter to it.",
    "no-viewport": "Add the viewport meta tag so the page adapts correctly to phone screens.",
    "missing-alt": "Write alt text for each relevant image on the site.",
    "no-sitemap": "Generate and publish a sitemap.xml listing the site's pages.",
    "low-performance": "Review what's weighing load time down the most — usually large images, unused scripts, or fonts loaded unnecessarily.",
    "slow-load-impact": "Prioritize loading the page's main content before anything secondary.",
    "layout-shift": "Reserve space for images, ads, and blocks that load later, so they don't push the rest of the page around.",
    "color-contrast": "Adjust text and background colors to increase contrast in the flagged areas.",
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
export type { IssueCategory };
