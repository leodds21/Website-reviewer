# Análise de ferramentas concorrentes — lsdias.dev

Documento de análise. Objetivo original: comparar o que o lsdias.dev fazia contra as ferramentas de diagnóstico de site mais usadas do mercado, organizadas nas mesmas seis categorias em que foram apresentadas, e apontar o que valeria a pena considerar como adição futura.

> **Atualizado após implementação.** A maior parte da síntese de prioridade original (seção final) já foi construída: headers de segurança, sinais extras do payload da PageSpeed (CLS, TTFB, contraste de cor, ordem de heading, rótulos de formulário), detecção simplificada de plataforma e checagem de links quebrados na home. Cada seção abaixo indica o que mudou; a análise original (o que era avaliação, não fato) foi preservada onde ainda vale como contexto.

## Como o lsdias.dev funciona hoje (pra dar contexto às comparações)

- **Uma URL, sem login, sem verificação de propriedade** — "roda, mostra, some". Isso já exclui de comparação direta qualquer ferramenta que exija ser dono/verificar o site (Google Search Console, Ahrefs Webmaster Tools).
- **Só a página inicial é analisada**, não o site inteiro. Ferramentas que rastreiam várias páginas (Screaming Frog, Bing Site Scan) operam num nível que o lsdias.dev simplesmente não alcança hoje — não é uma lacuna pontual, é uma diferença de arquitetura. A checagem de links quebrados (seção 6) é a exceção parcial: segue os links *que aparecem* na home, sem rastrear o resto do site.
- **Checagens atuais**, uma por arquivo em `lib/checks/`:
  - `https.ts` — o site serve em HTTPS, segue redirecionamento de http→https, certificado válido (sem indício de nada além disso: não olha versão do TLS).
  - `securityHeaders.ts` — lê HSTS, Content-Security-Policy e proteção contra clickjacking dos mesmos headers que `https.ts` já busca, sem requisição própria.
  - `metaTags.ts` — presença de `<title>`, meta description, meta viewport, tudo via regex sobre o HTML já buscado (não é um DOM renderizado).
  - `altImages.ts` — amostra de imagens sem `alt`.
  - `sitemapRobots.ts` — existência de `sitemap.xml` (validando que o corpo é XML de verdade, não um 200 com página de erro) e `robots.txt`.
  - `techDetect.ts` — reconhece WordPress/Wix/Squarespace/Shopify a partir do mesmo HTML da home, sem requisição própria. Não é um achado: vira um campo neutro no relatório (`report.platform`), fora da lista de problemas, porque rodar numa dessas plataformas não é em si um problema a corrigir.
  - `brokenLinks.ts` — amostra de até 10 links da própria home, verificados em paralelo (timeout de 3s cada, via `safeFetch`).
  - `pagespeed.ts` — reaproveita a API do Google PageSpeed Insights (Lighthouse por baixo dos panos): os 4 scores de categoria (performance, acessibilidade, boas práticas, SEO), LCP, CLS, TTFB, e as auditorias de contraste de cor, ordem de heading e rótulos de formulário.
- **Tom do produto**: achados viram frase em linguagem simples pra dono de site não-técnico, não relatório de dev. Isso pesa nas recomendações abaixo — uma funcionalidade forte tecnicamente mas difícil de traduzir em "isso está te custando venda" vale menos aqui do que valeria numa ferramenta pra desenvolvedor.

---

## 1. Diagnóstico geral e performance

### Google PageSpeed Insights
**Já fazemos.** É literalmente nossa fonte de dados — `lib/pagespeed.ts` chama a mesma API v5 (Lighthouse). Os 4 scores de categoria, LCP, CLS e TTFB (`server-response-time`) que aparecem no relatório vêm de lá.

**O que eles fazem diferente:** o PSI roda mobile *e* desktop lado a lado e expõe INP separadamente, além de uma lista de "oportunidades" específicas ("reduza JavaScript não utilizado", "otimize imagens", com o tamanho estimado de cada ganho). Isso ainda não é extraído — não é limitação de acesso, é limitação de aproveitamento: os dados já vêm na mesma resposta que já pagamos de cota, mas exigiriam um novo formato de achado (uma lista de recomendações técnicas, não um código+parâmetros único) pra caber no modelo atual de `lib/issues.ts`.

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
**Fazemos parcialmente** — a checagem de links quebrados (seção 6) cobre a versão de uma página só do que ele faz; meta-tags cobre uma fração pequena do resto.

**O que eles fazem diferente:** ferramenta desktop com crawl completo — links quebrados em todo o site, redirects em cadeia, títulos e descriptions duplicados entre páginas do mesmo site, problemas de canonical.

**Avaliação:** a parte de "links quebrados" já saiu do médio prazo pro presente, limitada à home. O resto (duplicação de título/description entre páginas, canonical, links quebrados no site inteiro) continua dependendo de rastrear mais de uma página — mesma mudança arquitetural de sempre, ainda não feita.

---

## 3. Acessibilidade

### WAVE
**Fazemos parcialmente** — contraste de cor, ordem de heading e rótulos de formulário (via auditorias específicas do Lighthouse, extraídas em `lib/pagespeed.ts`) mais a amostra de alt-text (`altImages.ts`) cobrem uma fatia real do que o WAVE cobre.

**O que eles fazem diferente:** estrutura semântica/ARIA mais ampla, analisando a página já renderizada (via extensão de navegador), não regex sobre o HTML cru nem auditorias do Lighthouse.

**Avaliação:** a adição mais forte apontada no documento original já foi feita. `color-contrast`, `heading-order` e `label` eram auditorias que o Lighthouse já calculava dentro do accessibility score que já chamávamos — só faltava extrair e virar achado próprio. O que resta (estrutura semântica/ARIA mais ampla) exigiria um parser de DOM de verdade, não regex — fora de escopo por ora, mesmo motivo do axe DevTools abaixo.

### axe DevTools
**Fazemos indiretamente** — o Lighthouse usa o motor axe-core por baixo dos panos pro accessibility score.

**O que eles fazem diferente:** roda no DOM já renderizado no navegador do desenvolvedor, encontra mais violações do que a auditoria automatizada isolada.

**Avaliação:** nenhuma ação nova aqui — o essencial já vem de graça via Lighthouse.

### Lighthouse
Já coberto na seção de performance — mesma ferramenta, mesmo ponto.

---

## 4. Segurança

### Mozilla HTTP Observatory
**Fazemos parcialmente.** `securityHeaders.ts` lê HSTS, Content-Security-Policy e proteção contra clickjacking (X-Frame-Options ou `frame-ancestors` na CSP) da mesma resposta que o check de HTTPS já busca — sem chamada externa nova.

**O que eles fazem diferente:** nota de A a F, e mais headers (Referrer-Policy, Permissions-Policy, Cross-Origin-*), com peso e explicação por header.

**Avaliação:** o núcleo da recomendação original (ler headers de segurança sem custo de requisição extra) já está implementado e alimentando o score de segurança e a lista de achados. Ampliar pra Referrer-Policy/Permissions-Policy é uma extensão pequena do mesmo arquivo, se algum dia valer a pena.

### SecurityHeaders
Mesmo escopo do Mozilla Observatory acima — coberto pelo mesmo `securityHeaders.ts`.

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
**Fazemos parcialmente.** `techDetect.ts` reconhece WordPress, Wix, Squarespace e Shopify a partir do mesmo HTML que `fetchHtml` já busca, sem chamada nova — via `<meta name="generator">` e hosts de asset conhecidos (`wp-content`, `static.wixstatic.com`, `static1.squarespace.com`, `cdn.shopify.com`).

**O que eles fazem diferente:** cobertura de milhares de fingerprints (framework JS, ferramenta de analytics, hospedagem, bibliotecas), não só os quatro construtores de site mais comuns.

**Avaliação:** decisão de produto tomada de forma diferente da sugestão original — em vez de virar um "achado" (a análise original sugeria o gancho "seu site roda numa plataforma sem atualização", mas isso exigiria saber a versão instalada *e* a mais recente pra comparar, o que essa checagem não faz), a plataforma detectada aparece como informação neutra no relatório (`report.platform`, mostrada como "Feito em WordPress" etc.), fora da lista de problemas. Rodar em WordPress não é em si um problema a corrigir, e apresentar como se fosse contrariaria o tom honesto do produto.

---

## 6. Links quebrados e HTML

### W3C Markup Validation Service / W3C CSS Validation Service
**Não fazemos nada equivalente.**

**O que eles fazem diferente:** validam o HTML/CSS contra a especificação formal, apontando tags mal fechadas, atributos inválidos, etc.

**Avaliação:** baixa prioridade. Validação estrita tende a gerar muito ruído técnico — a maioria dos sites reais "funciona" mesmo com erros de validação, porque navegadores são tolerantes — e não é um achado fácil de traduzir pra "isso está custando venda pro seu negócio". Foge do tom do produto.

### Broken Link Checker / Dr. Link Check
**Fazemos parcialmente.** `brokenLinks.ts` verifica até 10 links extraídos da própria home, em paralelo (timeout de 3s por link, via `safeFetch` — reaproveita as mesmas proteções de SSRF de todo o resto do produto). Um link 4xx/5xx conta como quebrado; falha de rede vira "não verificado", nunca "quebrado" — se nenhum link da amostra puder ser checado, a checagem inteira falha em vez de arriscar um falso "0 quebrados".

**O que eles fazem diferente:** rastreiam todos os links (internos e externos) do site inteiro, não só os que aparecem na home, e sem limite de amostra.

**Avaliação:** a versão limitada (só a home, amostra pequena) que a análise original já apontava como viável foi implementada. Continua fora do produto: seguir os links pra outras páginas do site e rastrear a partir delas — isso é a mesma mudança arquitetural "uma página → o site inteiro" citada em Screaming Frog/Bing Site Scan.

---

## Síntese: prioridade sugerida (esforço × valor de geração de lead)

Lista original, ordenada do que parecia mais barato/valioso pro que parecia mais caro/de menor retorno. Os quatro primeiros itens já foram implementados — mantidos aqui, marcados, como registro de que a priorização se confirmou na prática:

1. ~~**Headers de segurança**~~ **✅ feito** (`lib/checks/securityHeaders.ts`) — zero requisição nova, os headers vêm na resposta que o check de HTTPS já busca.
2. ~~**Aproveitar mais o payload do PageSpeed que já recebemos**~~ **✅ feito** (`lib/pagespeed.ts`) — CLS, TTFB e as auditorias de contraste de cor, hierarquia de heading e rótulos de formulário agora saem da mesma resposta que já pagávamos de cota.
3. ~~**Detecção de tecnologia simplificada**~~ **✅ feito** (`lib/checks/techDetect.ts`) — com uma diferença da sugestão original: vira campo neutro no relatório, não um achado com severidade (ver seção 5).
4. ~~**Links quebrados só na home**~~ **✅ feito** (`lib/checks/brokenLinks.ts`) — amostra de 10 links, timeout de 3s cada, em paralelo.
5. **Crawl multi-página** (títulos/descriptions duplicados, links quebrados em todo o site, ao estilo Screaming Frog/Bing Site Scan) — potencial alto, mas é mudança de arquitetura grande (de "uma página" pra "um site"), não um ajuste pontual. Ainda não feito.
6. **TLS aprofundado** (tipo SSL Labs), **scan de malware** (tipo Sucuri), **validação W3C de HTML/CSS** — prioridade baixa: ou o esforço de implementação é desproporcional ao ganho (TLS, malware), ou o achado não converte bem em algo que um dono de site não-técnico entenda como problema real (validação W3C). Ainda não feito, e provavelmente não vale a pena.

**Fora de escopo por incompatibilidade de modelo** (exigem ser dono/verificar o site — contraria o "roda, mostra, some" sem login): Google Search Console, Ahrefs Webmaster Tools.
