import type { Issue, IssueCode, IssueSeverity } from "@/lib/issues";
import type { Severity } from "@/lib/score";
import type { AnalyzeError, AnalyzeErrorCode } from "@/lib/analyzeError";
import type { ContactErrorCode } from "@/app/hooks/useContactForm";
import type { FailureReason } from "@/lib/checkFailure";
import type { StepKey } from "@/lib/scanSteps";
import type { PassCode } from "@/lib/passes";
import type { ScoreComponentKey } from "@/lib/score";

// Rounds up: better to say wait a bit longer than to send someone back too soon.
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

// Old name kept: renaming it would reset returning visitors' language.
export const LOCALE_COOKIE = "isdias-lang";

type IssueParams = Record<string, string | number> | undefined;

type Dictionary = {
  documentTitle: string;
  subheadline: string;
  homeHeadline: string;
  homeIntro: string;
  analyzeLabel: string;
  urlPlaceholder: string;
  runButton: string;
  runningButton: string;
  scanPlan: {
    heading: string;
    progress: (done: number, total: number) => string;
    progressLabel: string;
    status: Record<"waiting" | "running" | "done", string>;
    steps: Record<StepKey, { name: string; description: string }>;
  };
  privacyNote: string;
  privacyLinkLabel: string;
  close: string;
  privacyPolicy: {
    title: string;
    sections: { label: string; text: string }[];
  };
  overallScore: string;
  scoreLabelOk: string;
  scoreLabelAttention: string;
  scoreLabelCritical: string;
  // Parts, not one string, so a line never breaks inside a count.
  issueSummary: (counts: Record<IssueSeverity, number>) => string[];
  scoreExplanationToggle: string;
  scoreExplanation: string;
  overallArithmetic: (scores: number[], exact: number, overall: number) => string;
  scoreBreakdownToggle: string;
  scoreBreakdownIntro: (measurements: number) => string;
  scoreBreakdownStart: string;
  scoreBreakdownTotal: string;
  scoreSingleMeasurement: string;
  scoreComponent: Record<ScoreComponentKey, (value: number, count?: number) => string>;
  scoreFromGoogle: (value: number) => string;
  securityWithoutHttps: string;
  categories: Record<"performance" | "seo" | "accessibility" | "security", string>;
  severity: Record<Severity | IssueSeverity, string>;
  unavailableReason: Record<FailureReason, string>;
  partialMeasure: string;
  loadTime: (seconds: number) => string;
  coverageNote: (measured: number) => string;
  blockedNote: string;
  manualAnalysisButton: string;
  manualKicker: string;
  manualHeadline: string;
  manualBody: string;
  manualMessagePrefill: (domain: string) => string;
  howToFix: string;
  findingGroups: Record<IssueSeverity, string>;
  topIssuesHeading: string;
  topIssuesNone: string;
  impactLabel: Record<Exclude<IssueSeverity, "sugestao">, string>;
  viewDetails: string;
  optionalNote: string;
  showOptional: (count: number) => string;
  affectedHeading: Partial<Record<IssueCode, (count: number) => string>>;
  imageWithoutSource: string;
  moreAffected: (count: number) => string;
  noIssues: string;
  passesHeading: string;
  passesToggle: (count: number) => string;
  pass: Record<PassCode, string>;
  newAnalysis: string;
  reportCta: string;
  printButton: string;
  printFooter: (host: string) => string;
  backToReport: string;
  nextStepButton: string;
  nextStepButtonClean: string;
  cleanHeadline: string;
  cleanBody: string;
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
  platformDetected: (platformName: string) => string;
  madeByLabel: string;
  opensNewTab: string;
  // `retryAfterSeconds` is only set for rate-limited.
  analysisError: Record<AnalyzeErrorCode, (retryAfterSeconds?: number) => string>;
  issue: Record<IssueCode, (params: IssueParams) => { title: string; description: string }>;
  // A noun phrase for synthesizeImpact(), e.g. "the insecure connection".
  impactClause: Partial<Record<IssueCode, string>>;
  // Per locale: joining words and verb agreement differ by language.
  synthesizeImpact: (clauses: string[]) => string;
  // Describes the fix only; never promises a result.
  recommendation: Record<IssueCode, string>;
};

const pt: Dictionary = {
  documentTitle: "lsdias.dev, diagnóstico de site",
  subheadline:
    "A gente encontra o seu em menos de um minuto: performance, SEO, acessibilidade e segurança, tudo junto.",
  homeHeadline: "Descubra o que está atrapalhando o seu site.",
  homeIntro: "Sete checagens reais rodando ao mesmo tempo. Você acompanha cada uma em tempo real.",
  analyzeLabel: "Endereço do site",
  urlPlaceholder: "seusite.com.br",
  runButton: "Rodar diagnóstico",
  runningButton: "Analisando…",
  scanPlan: {
    heading: "Plano da varredura",
    progress: (done, total) => `${done} / ${total} concluídas`,
    progressLabel: "Progresso",
    status: { waiting: "em espera", running: "verificando", done: "concluída" },
    steps: {
      https: { name: "https", description: "Conexão segura e certificado" },
      securityHeaders: { name: "cabeçalhos", description: "Proteções do servidor" },
      metaTags: { name: "meta tags", description: "Título, descrição e viewport" },
      altImages: { name: "imagens", description: "Texto alternativo numa amostra" },
      sitemapRobots: { name: "sitemap", description: "sitemap.xml e robots.txt" },
      brokenLinks: { name: "links", description: "Links da home que levam a erro" },
      pagespeed: { name: "pagespeed", description: "Velocidade e acessibilidade, medidas pelo Google" },
    },
  },
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
        text: "A URL vai para o Google PageSpeed Insights, que gera parte do relatório. O relatório e o controle de abuso ficam no Upstash, um banco em nuvem; o formulário de contato passa pelo Formspree até o nosso e-mail. O site roda na Vercel.",
      },
      {
        label: "Por quanto tempo guardamos",
        text: "O relatório fica em cache por até 6 horas e depois é descartado. Quando uma checagem falha, o endereço analisado pode aparecer nos registros técnicos do servidor, usados só pra corrigir problemas. Não guardamos os dados do formulário em nenhum banco de dados próprio.",
      },
      {
        label: "Rastreamento",
        text: "Sem analytics. O único cookie guarda o seu idioma. Seu IP só serve pra limitar abusos e fica guardado por até 1 hora, sem ligação com você.",
      },
    ],
  },
  overallScore: "Nota geral",
  scoreLabelOk: "Está bem",
  scoreLabelAttention: "Precisa de atenção",
  scoreLabelCritical: "Tem problemas sérios",
  issueSummary: ({ critico, atencao, sugestao }) =>
    [
      critico > 0 && `${critico} ${critico === 1 ? "crítico" : "críticos"}`,
      atencao > 0 && `${atencao} de atenção`,
      sugestao > 0 && `${sugestao} ${sugestao === 1 ? "sugestão" : "sugestões"}`,
    ].filter((part): part is string => Boolean(part)),
  scoreExplanationToggle: "Como calculamos esta nota",
  scoreExplanation:
    "A nota geral é a média simples das categorias, e cada categoria é a média das suas medições: notas do Google e checagens nossas. Sugestões não mudam o número. Uma categoria \"não medido\" fica fora da conta, e \"medido em parte\" quer dizer que alguma checagem dela não rodou.",
  overallArithmetic: (scores, exact, overall) =>
    `(${scores.join(" + ")}) ÷ ${scores.length} = ${exact.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${exact === overall ? "" : ` → ${overall}`}`,
  scoreBreakdownToggle: "Entenda esta nota",
  scoreBreakdownIntro: (measurements) => `Média de ${measurements} medições: cada uma vale 1/${measurements} da nota.`,
  scoreBreakdownStart: "Partindo de",
  scoreBreakdownTotal: "Nota",
  scoreSingleMeasurement: "Só uma medição entrou nesta nota:",
  scoreComponent: {
    "google-performance": (value) => `Nota de desempenho do Google: ${value}`,
    "google-seo": (value) => `Avaliação de SEO do Google: ${value}`,
    title: (value) => (value === 100 ? "Título da página presente" : "Título da página ausente"),
    description: (value) => (value === 100 ? "Meta description presente" : "Meta description ausente"),
    links: (value, count) => (count === 0 ? "Nenhum link na home para checar" : `Links da home funcionando: ${Math.round(value)}%`),
    "google-accessibility": (value) => `Avaliação de acessibilidade do Google: ${value}`,
    viewport: (value) => (value === 100 ? "Ajuste para celular presente" : "Ajuste para celular ausente"),
    "alt-images": (value, count) =>
      count === 0 ? "Nenhuma imagem na página para checar" : `Imagens com texto alternativo: ${Math.round(value)}%`,
    https: (value) => (value === 100 ? "HTTPS ativo, com redirecionamento" : value === 0 ? "Sem HTTPS confiável" : "HTTPS sem redirecionamento"),
    "google-best-practices": (value) => `Boas práticas do Google: ${value}`,
  },
  scoreFromGoogle: (value) => `Vem direto do Google PageSpeed, medido como celular: ${value}.`,
  securityWithoutHttps: "Sem HTTPS confiável, a segurança fica em 0, independente do resto.",
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
  // PageSpeed measures as a phone on a mobile connection by default.
  loadTime: (seconds) => `Carrega em ${seconds.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}s no celular`,
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
  howToFix: "Como resolver",
  findingGroups: { critico: "Críticos", atencao: "Atenção", sugestao: "Melhorias opcionais" },
  topIssuesHeading: "Corrija primeiro",
  topIssuesNone: "Nenhum problema prioritário. Só melhorias opcionais abaixo.",
  impactLabel: { critico: "Alto impacto", atencao: "Médio impacto" },
  viewDetails: "Ver detalhes",
  optionalNote: "não mudam a nota",
  showOptional: (count) => (count === 1 ? "Ver a melhoria opcional" : `Ver as ${count} melhorias opcionais`),
  affectedHeading: {
    "missing-alt": (count) => (count === 1 ? "A imagem afetada" : `As ${count} imagens afetadas`),
    "broken-links": (count) => (count === 1 ? "O link quebrado" : `Os ${count} links quebrados`),
  },
  imageWithoutSource: "(imagem sem endereço no HTML)",
  moreAffected: (count) => `e mais ${count}`,
  noIssues: "Não encontramos problema nenhum nas checagens que rodamos.",
  passesHeading: "O que está certo",
  passesToggle: (count) => (count === 1 ? "Ver o ponto que passou" : `Ver os ${count} pontos que passaram`),
  pass: {
    https: "Conexão segura: o site abre em HTTPS",
    "security-headers": "Proteções extras do servidor ativadas",
    title: "A página tem um título próprio",
    description: "A página tem uma descrição pro Google",
    viewport: "Se ajusta à tela do celular",
    "alt-images": "As imagens têm texto alternativo",
    sitemap: "Tem um sitemap pro Google achar as páginas",
    links: "Os links testados na home funcionam",
    "fast-load": "Carrega rápido no celular",
    "stable-layout": "Nada pula de lugar enquanto a página carrega",
  },
  newAnalysis: "Nova análise",
  reportCta: "Quer ajuda pra resolver o que apareceu aqui?",
  printButton: "Imprimir ou salvar PDF",
  printFooter: (host) => `Diagnóstico gerado em ${host}`,
  backToReport: "Voltar ao relatório",
  nextStepButton: "Ver como corrigir →",
  nextStepButtonClean: "Falar sobre o site →",
  cleanHeadline: "O site passou nas checagens que fizemos.",
  cleanBody: "Uma análise automática não vê tudo. Se quiser uma segunda opinião sobre o site, é só escrever.",
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
    "not-cached": () => "O relatório desse link não está mais guardado. Rode o diagnóstico pra ver o resultado de agora.",
  },
  issue: {
    "no-https": () => ({
      title: "O site não é servido em HTTPS.",
      description: "Navegadores marcam a conexão como não segura, e isso afasta visitante e cliente.",
    }),
    "no-https-redirect": () => ({
      title: "O site tem HTTPS, mas não leva o visitante até ele.",
      description: "Quem digita o endereço sem o https:// continua na versão não segura, e o navegador mostra o aviso de conexão não segura.",
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
    // Only codes that can be critical need a clause.
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
    "no-https-redirect": "Configurar o servidor pra redirecionar todo acesso por http:// pro mesmo endereço em https://.",
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
  subheadline: "We find yours in under a minute: performance, SEO, accessibility and security, all at once.",
  homeHeadline: "Find out what's holding your site back.",
  homeIntro: "Seven real checks running at the same time. You can follow each one as it runs.",
  analyzeLabel: "Site address",
  urlPlaceholder: "yoursite.com",
  runButton: "Run diagnosis",
  runningButton: "Analyzing…",
  scanPlan: {
    heading: "Scan plan",
    progress: (done, total) => `${done} / ${total} done`,
    progressLabel: "Progress",
    status: { waiting: "waiting", running: "checking", done: "done" },
    steps: {
      https: { name: "https", description: "Secure connection and certificate" },
      securityHeaders: { name: "headers", description: "Server protections" },
      metaTags: { name: "meta tags", description: "Title, description and viewport" },
      altImages: { name: "images", description: "Alt text on a sample" },
      sitemapRobots: { name: "sitemap", description: "sitemap.xml and robots.txt" },
      brokenLinks: { name: "links", description: "Homepage links that lead to errors" },
      pagespeed: { name: "pagespeed", description: "Speed and accessibility, measured by Google" },
    },
  },
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
        text: "The URL goes to Google PageSpeed Insights, which generates part of the report. The report and the abuse limit are kept in Upstash, a cloud database; the contact form goes through Formspree to our inbox. The site runs on Vercel.",
      },
      {
        label: "How long we keep it",
        text: "The report is cached for up to 6 hours, then discarded. When a check fails, the analyzed address may appear in the server's technical logs, used only to fix problems. We don't keep contact form data in any database of our own.",
      },
      {
        label: "Tracking",
        text: "No analytics. The only cookie remembers your language. Your IP is only used to limit abuse and is kept for up to 1 hour, not tied to your identity.",
      },
    ],
  },
  overallScore: "Overall score",
  scoreLabelOk: "Looking good",
  scoreLabelAttention: "Needs attention",
  scoreLabelCritical: "Has serious problems",
  issueSummary: ({ critico, atencao, sugestao }) =>
    [
      critico > 0 && `${critico} critical`,
      atencao > 0 && `${atencao} needing attention`,
      sugestao > 0 && `${sugestao} ${sugestao === 1 ? "suggestion" : "suggestions"}`,
    ].filter((part): part is string => Boolean(part)),
  scoreExplanationToggle: "How we calculate this score",
  scoreExplanation:
    "The overall score is a simple average of the categories, and each category is the average of its measurements: Google's scores and our own checks. Suggestions don't change the number. A \"not measured\" category is left out, and \"partly measured\" means one of its checks couldn't run.",
  overallArithmetic: (scores, exact, overall) =>
    `(${scores.join(" + ")}) ÷ ${scores.length} = ${exact.toLocaleString("en-US", { maximumFractionDigits: 2 })}${exact === overall ? "" : ` → ${overall}`}`,
  scoreBreakdownToggle: "Understand this score",
  scoreBreakdownIntro: (measurements) => `Average of ${measurements} measurements: each is worth 1/${measurements} of the score.`,
  scoreBreakdownStart: "Starting from",
  scoreBreakdownTotal: "Score",
  scoreSingleMeasurement: "Only one measurement went into this score:",
  scoreComponent: {
    "google-performance": (value) => `Google's performance score: ${value}`,
    "google-seo": (value) => `Google's SEO score: ${value}`,
    title: (value) => (value === 100 ? "Page title present" : "Page title missing"),
    description: (value) => (value === 100 ? "Meta description present" : "Meta description missing"),
    links: (value, count) => (count === 0 ? "No home page links to check" : `Home page links working: ${Math.round(value)}%`),
    "google-accessibility": (value) => `Google's accessibility score: ${value}`,
    viewport: (value) => (value === 100 ? "Phone screen fit present" : "Phone screen fit missing"),
    "alt-images": (value, count) => (count === 0 ? "No images on the page to check" : `Images with alternative text: ${Math.round(value)}%`),
    https: (value) => (value === 100 ? "HTTPS on, with redirect" : value === 0 ? "No trusted HTTPS" : "HTTPS without redirect"),
    "google-best-practices": (value) => `Google's best practices: ${value}`,
  },
  scoreFromGoogle: (value) => `Straight from Google PageSpeed, measured as a phone: ${value}.`,
  securityWithoutHttps: "Without trusted HTTPS, security stays at 0 regardless of anything else.",
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
  loadTime: (seconds) => `Loads in ${seconds.toLocaleString("en-US", { maximumFractionDigits: 1 })}s on phones`,
  coverageNote: (measured) =>
    `Score based on ${measured} of 4 categories. The others couldn't be measured, see why below.`,
  blockedNote:
    "This site refuses automated tools, so some parts couldn't be measured. That doesn't mean something is wrong with it: many sites block bots for security.",
  manualAnalysisButton: "Request a manual review",
  manualKicker: "Manual review",
  manualHeadline: "This site can be looked at up close, without relying on a bot.",
  manualBody: "Since the site blocked the automated analysis, I can review it directly in a browser and send you what I find.",
  manualMessagePrefill: (domain) => `I'd like a manual review of ${domain}.`,
  howToFix: "How to fix it",
  findingGroups: { critico: "Critical", atencao: "Needs attention", sugestao: "Optional improvements" },
  topIssuesHeading: "Fix these first",
  topIssuesNone: "Nothing urgent: only optional improvements below.",
  impactLabel: { critico: "High impact", atencao: "Medium impact" },
  viewDetails: "View details",
  optionalNote: "don't affect the score",
  showOptional: (count) => (count === 1 ? "See the optional improvement" : `See the ${count} optional improvements`),
  affectedHeading: {
    "missing-alt": (count) => (count === 1 ? "The affected image" : `The ${count} affected images`),
    "broken-links": (count) => (count === 1 ? "The broken link" : `The ${count} broken links`),
  },
  imageWithoutSource: "(image with no address in the HTML)",
  moreAffected: (count) => `and ${count} more`,
  noIssues: "We didn't find any problems in the checks we ran.",
  passesHeading: "What's working",
  passesToggle: (count) => (count === 1 ? "See the check that passed" : `See the ${count} checks that passed`),
  pass: {
    https: "Secure connection: the site loads over HTTPS",
    "security-headers": "The server's extra protections are on",
    title: "The page has a title of its own",
    description: "The page has a description for Google",
    viewport: "Fits phone screens",
    "alt-images": "Images have alternative text",
    sitemap: "Has a sitemap that helps Google find the pages",
    links: "The links tested on the home page work",
    "fast-load": "Loads fast on phones",
    "stable-layout": "Nothing jumps around while the page loads",
  },
  newAnalysis: "New analysis",
  reportCta: "Want help fixing what showed up here?",
  printButton: "Print or save as PDF",
  printFooter: (host) => `Report generated at ${host}`,
  backToReport: "Back to the report",
  nextStepButton: "See how to fix it →",
  nextStepButtonClean: "Talk about the site →",
  cleanHeadline: "The site passed the checks we ran.",
  cleanBody: "An automated analysis doesn't see everything. If you'd like a second opinion on the site, just write.",
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
    "not-cached": () => "This link's report is no longer stored. Run the diagnosis to see the current result.",
  },
  issue: {
    "no-https": () => ({
      title: "The site isn't served over HTTPS.",
      description: "Browsers flag the connection as not secure, which drives visitors and customers away.",
    }),
    "no-https-redirect": () => ({
      title: "The site has HTTPS, but doesn't send visitors to it.",
      description: "Anyone who types the address without https:// stays on the unsecured version, and the browser shows the not-secure warning.",
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
    "no-https-redirect": "Configure the server to redirect every http:// request to the same address over https://.",
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
  // A cached report or a newer server can send a code this bundle doesn't know.
  const entry = DICTIONARIES[locale].issue[code];
  if (!entry) return { title: code, description: "" };
  return entry(params);
}

export function translateRecommendation(locale: Locale, code: IssueCode): string {
  return DICTIONARIES[locale].recommendation[code];
}

export function translateAnalysisError(locale: Locale, error: AnalyzeError): string {
  const dictionary = DICTIONARIES[locale].analysisError;
  // Same for error codes from a newer server.
  const entry = dictionary[error.code] ?? dictionary.unknown;
  return entry(error.retryAfterSeconds);
}

// One sentence from the first 1-2 critical findings, at most one per
// category so two performance findings don't repeat each other.
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
