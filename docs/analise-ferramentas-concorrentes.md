# Análise de ferramentas concorrentes — lsdias.dev

Documento de análise, sem nenhuma implementação. Objetivo: comparar o que o lsdias.dev já faz hoje contra as ferramentas de diagnóstico de site mais usadas do mercado, organizadas nas mesmas seis categorias em que foram apresentadas, e apontar o que valeria a pena considerar como adição futura.

## Como o lsdias.dev funciona hoje (pra dar contexto às comparações)

- **Uma URL, sem login, sem verificação de propriedade** — "roda, mostra, some". Isso já exclui de comparação direta qualquer ferramenta que exija ser dono/verificar o site (Google Search Console, Ahrefs Webmaster Tools).
- **Só a página inicial é analisada**, não o site inteiro. Ferramentas que rastreiam várias páginas (Screaming Frog, Bing Site Scan, checkers de link quebrado) operam num nível que o lsdias.dev simplesmente não alcança hoje — não é uma lacuna pontual, é uma diferença de arquitetura.
- **Checagens atuais**, uma por arquivo em `lib/checks/`:
  - `https.ts` — o site serve em HTTPS, segue redirecionamento de http→https, certificado válido (sem indício de nada além disso: não olha headers, não olha versão do TLS).
  - `meta-tags.ts` — presença de `<title>`, meta description, meta viewport, tudo via regex sobre o HTML já buscado (não é um DOM renderizado).
  - `alt-images.ts` — amostra de imagens sem `alt`.
  - `sitemap-robots.ts` — existência de `sitemap.xml` (validando que o corpo é XML de verdade, não um 200 com página de erro) e `robots.txt`.
  - `pagespeed.ts` — reaproveita a API do Google PageSpeed Insights (Lighthouse por baixo dos panos): os 4 scores de categoria (performance, acessibilidade, boas práticas, SEO) e o LCP.
- **Tom do produto**: achados viram frase em linguagem simples pra dono de site não-técnico, não relatório de dev. Isso pesa nas recomendações abaixo — uma funcionalidade forte tecnicamente mas difícil de traduzir em "isso está te custando venda" vale menos aqui do que valeria numa ferramenta pra desenvolvedor.

---

## 1. Diagnóstico geral e performance

### Google PageSpeed Insights
**Já fazemos.** É literalmente nossa fonte de dados — `lib/pagespeed.ts` chama a mesma API v5 (Lighthouse). Os 4 scores de categoria e o LCP que aparecem no relatório vêm de lá.

**O que eles fazem diferente:** o PSI roda mobile *e* desktop lado a lado e expõe cada métrica de Core Web Vitals separadamente (LCP, CLS, INP, TTFB), além de uma lista de "oportunidades" específicas ("reduza JavaScript não utilizado", "otimize imagens", com o tamanho estimado de cada ganho). Hoje só extraímos os 4 scores agregados e o LCP desse payload — não é limitação de acesso, é limitação de aproveitamento: os outros dados já vêm na mesma resposta que já pagamos de cota.

### Lighthouse
**Já fazemos.** É o motor por trás do PageSpeed Insights que já usamos — mesma engine, não há nada novo aqui a considerar.

### WebPageTest
**Não fazemos nada equivalente.** Foco em waterfall de requisições, simulação de dispositivo/conexão e filmstrip visual do carregamento quadro a quadro.

**Avaliação:** fora de escopo por ora. É uma ferramenta de diagnóstico profundo pra quem vai mexer no código, não gera um achado fácil de explicar pra um dono de site leigo, e não tem uma API pública simples e gratuita equivalente ao que usamos hoje (self-host é um projeto à parte).

### GTmetrix
**Fazemos parcialmente** (o score de performance via PageSpeed cobre o mesmo território, de forma mais resumida).

**O que eles fazem diferente:** waterfall parecido com o WebPageTest, mas com relatório mais palatável e uma nota de A a F.

**Avaliação:** baixa prioridade. A ideia da "nota simples" já está coberta pelo nosso sistema de severidade (crítico/atenção/ok); o waterfall detalhado tem o mesmo problema de público-alvo do WebPageTest.

---

## 2. SEO e estrutura técnica

### Google Search Console
**Não fazemos nada equivalente — e não dá pra fazer no modelo atual.** GSC exige que a pessoa seja dona do site e verifique a propriedade (DNS, arquivo, tag). Isso contraria diretamente o "roda, mostra, some" sem login que é a proposta do lsdias.dev.

**O que eles fazem diferente:** dados reais de indexação (quais páginas o Google efetivamente indexou), cliques e impressões nas buscas, Core Web Vitals de campo (dados reais de usuários via CrUX, não só simulação de laboratório).

**Avaliação:** fora de escopo estrutural. Não é questão de prioridade, é incompatibilidade de modelo de produto.

### Bing Webmaster Tools – Site Scan
**Fazemos parcialmente** — a checagem de sitemap/robots é o mesmo espírito (ajudar o rastreador a encontrar as páginas certas).

**O que eles fazem diferente:** rastreiam o site inteiro, não só a home, e reportam problemas técnicos por página.

**Avaliação:** interessante a médio prazo, mas depende de crawl multi-página — mudança de arquitetura, não um ajuste pontual numa checagem existente.

### Ahrefs Webmaster Tools
**Não fazemos nada equivalente.** Foco em backlinks e auditoria de domínio, também exige propriedade verificada.

**Avaliação:** fora de escopo, mesmo motivo do Search Console.

### Screaming Frog
**Não fazemos nada diretamente equivalente**, mas conceitualmente nosso check de meta-tags é uma versão em miniatura de uma fração pequena do que ele cobre.

**O que eles fazem diferente:** ferramenta desktop com crawl completo — links quebrados, redirects em cadeia, títulos e descriptions duplicados entre páginas do mesmo site, problemas de canonical.

**Avaliação:** uma das ideias mais fortes da lista inteira pra médio prazo. "3 páginas do seu site têm o mesmo título" ou "seu site tem 5 links quebrados" são achados extremamente fáceis de explicar e com forte apelo de geração de lead — mas dependem de rastrear mais de uma página, que é a mesma mudança arquitetural citada acima.

---

## 3. Acessibilidade

### WAVE
**Fazemos parcialmente** — nosso check de alt-text cobre uma fração pequena do que o WAVE cobre.

**O que eles fazem diferente:** contraste de cor, hierarquia de heading, rótulos de formulário, estrutura semântica/ARIA — tudo isso analisando a página já renderizada (via extensão de navegador), não regex sobre o HTML cru.

**Avaliação:** **a adição mais forte de todo o documento.** Contraste de cor insuficiente é um problema visualmente óbvio até pra quem não é técnico ("esse texto cinza claro no fundo branco é difícil de ler"), e boa parte do trabalho pesado já está feito: o Lighthouse (que já chamamos) calcula auditorias específicas como `color-contrast`, `heading-order` e rótulos de formulário como parte do próprio accessibility score — hoje só usamos o número agregado, não as auditorias individuais que o compõem.

### axe DevTools
**Fazemos indiretamente** — o Lighthouse usa o motor axe-core por baixo dos panos pro accessibility score.

**O que eles fazem diferente:** roda no DOM já renderizado no navegador do desenvolvedor, encontra mais violações do que a auditoria automatizada isolada.

**Avaliação:** nenhuma ação nova aqui — o essencial já vem de graça via Lighthouse.

### Lighthouse
Já coberto na seção de performance — mesma ferramenta, mesmo ponto.

---

## 4. Segurança

### Mozilla HTTP Observatory
**Não fazemos nada equivalente.** Nosso check de segurança hoje se resume a "serve em HTTPS + certificado válido".

**O que eles fazem diferente:** avaliam a presença de headers de segurança (Content-Security-Policy, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) e dão uma nota de A a F.

**Avaliação: forte candidata a adição.** Os headers já vêm de graça na mesma resposta HTTP que o check de HTTPS já busca hoje — é ler `response.headers`, sem chamada externa nova, sem API key nova, sem custo de cota. Baixo esforço de implementação pra um conjunto de achados totalmente novo.

### SecurityHeaders
**Não fazemos nada equivalente** — mesma lacuna do Mozilla Observatory, escopo essencialmente idêntico (nota pros headers HTTP).

**Avaliação:** mesma recomendação do item anterior. Não faz sentido cobrir os dois separadamente — implementar a leitura de headers já cobre o território de ambos.

### SSL Labs Server Test
**Fazemos parcialmente** — verificamos se o certificado é válido (sem erro de cadeia), mas não avaliamos a qualidade da configuração TLS em si.

**O que eles fazem diferente:** versões de protocolo TLS suportadas (detecta TLS 1.0/1.1 obsoletos ainda habilitados), força das cifras, ordem de preferência, vulnerabilidades conhecidas.

**Avaliação:** baixa prioridade por ora. Exigiria inspecionar o handshake TLS diretamente, fora do que o `fetch` do Node expõe — mais esforço de implementação do que o resto da lista, pro público-alvo (pequenos negócios) raramente ter uma configuração TLS ruim o bastante pra valer o achado.

### Sucuri SiteCheck
**Não fazemos nada equivalente.**

**O que eles fazem diferente:** escaneiam malware, checam blacklists (Google Safe Browsing e afins), sinais de site comprometido/invadido.

**Avaliação:** interessante em tese, mas fora do escopo técnico atual — normalmente depende de bases de blacklist de terceiros ou de uma API paga (Google Safe Browsing), complexidade de integração maior que o resto da lista.

---

## 5. Tecnologias utilizadas

### Wappalyzer / BuiltWith / WhatRuns
**Não fazemos nada equivalente.**

**O que eles fazem diferente:** identificam CMS, framework, ferramenta de analytics, hospedagem e bibliotecas JS a partir de fingerprints — headers HTTP, scripts carregados, cookies, meta tags específicas (ex: `<meta name="generator" content="WordPress...">`).

**Avaliação: candidata interessante e de baixo custo.** Boa parte da detecção mais comum (WordPress, Wix, Squarespace, Shopify, Google Analytics/Tag Manager) dá pra fazer com o mesmo HTML que já buscamos hoje via `fetchHtml`, sem nenhuma chamada nova. Também tem valor direto de geração de lead: "seu site foi feito em uma plataforma que não recebe mais atualização" é um gancho de conversa natural. Não precisamos da cobertura de milhares de fingerprints do Wappalyzer — só os mais comuns entre o público-alvo do produto.

---

## 6. Links quebrados e HTML

### W3C Markup Validation Service / W3C CSS Validation Service
**Não fazemos nada equivalente.**

**O que eles fazem diferente:** validam o HTML/CSS contra a especificação formal, apontando tags mal fechadas, atributos inválidos, etc.

**Avaliação:** baixa prioridade. Validação estrita tende a gerar muito ruído técnico — a maioria dos sites reais "funciona" mesmo com erros de validação, porque navegadores são tolerantes — e não é um achado fácil de traduzir pra "isso está custando venda pro seu negócio". Foge do tom do produto.

### Broken Link Checker / Dr. Link Check
**Não fazemos nada diretamente equivalente** — hoje só verificamos a existência de `sitemap.xml`/`robots.txt`, não seguimos os links que aparecem na própria página.

**O que eles fazem diferente:** rastreiam todos os links (internos e externos) do site e reportam os que dão erro (404, timeout).

**Avaliação: candidata de médio prazo, boa mesmo numa versão limitada.** Checar só os links que aparecem na própria home (sem crawl recursivo pro resto do site) já é viável na arquitetura atual — o HTML da home já é buscado via `fetchHtml`. "3 links quebrados na sua página inicial" é um achado extremamente concreto e fácil de vender. Precisa de cuidado com o custo (N requisições extras por análise, dentro do timeout) e reaproveitar as mesmas proteções de SSRF que já existem em `safeFetch`.

---

## Síntese: prioridade sugerida (esforço × valor de geração de lead)

Ordenado do que parece mais barato/valioso pro que parece mais caro/de menor retorno — só análise, nenhuma decisão de implementação tomada:

1. **Headers de segurança** (equivalente a Mozilla Observatory/SecurityHeaders) — zero requisição nova, os headers já vêm na resposta que o check de HTTPS já busca hoje.
2. **Aproveitar mais o payload do PageSpeed que já recebemos** — CLS, TTFB e auditorias específicas de acessibilidade (contraste de cor, hierarquia de heading, rótulos de formulário) já estão na resposta da API que já pagamos de cota; hoje só usamos os 4 scores agregados e o LCP.
3. **Detecção de tecnologia simplificada** (tipo Wappalyzer, mas só pros fingerprints mais comuns) — o HTML da home já é buscado, é questão de reconhecer padrões nele.
4. **Links quebrados só na home** (sem crawl do site inteiro) — poucas requisições extras, achado com forte apelo de venda.
5. **Crawl multi-página** (títulos/descriptions duplicados, links quebrados em todo o site, ao estilo Screaming Frog/Bing Site Scan) — potencial alto, mas é mudança de arquitetura grande (de "uma página" pra "um site"), não um ajuste pontual.
6. **TLS aprofundado** (tipo SSL Labs), **scan de malware** (tipo Sucuri), **validação W3C de HTML/CSS** — prioridade baixa: ou o esforço de implementação é desproporcional ao ganho (TLS, malware), ou o achado não converte bem em algo que um dono de site não-técnico entenda como problema real (validação W3C).

**Fora de escopo por incompatibilidade de modelo** (exigem ser dono/verificar o site — contraria o "roda, mostra, some" sem login): Google Search Console, Ahrefs Webmaster Tools.
