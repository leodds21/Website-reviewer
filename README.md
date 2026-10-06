# lsdias.dev

**[scan.lsdias.dev](https://scan.lsdias.dev)** — demo ao vivo.

Ferramenta que analisa um site e devolve, em menos de um minuto, onde ele está pegando: performance, SEO, acessibilidade e segurança, tudo numa nota só.

## De onde veio

Nasceu de um processo manual: olhar sites de clientes em potencial (imigração, arquitetura, construção, esses segmentos) e apontar, na mão, o que estava lento, mal indexado ou sem HTTPS. Essa análise ad hoc é o que virou produto aqui. O relatório serve pra duas coisas ao mesmo tempo: é peça de portfólio técnico e é o ponto de partida de uma conversa real com quem recebe a má notícia sobre o próprio site.

## Como foi construído

Em fases pequenas, cada uma com commit próprio: primeiro as quatro checagens próprias (HTTPS, meta tags, alt em imagens, sitemap/robots.txt) isoladas e testadas contra sites reais antes de qualquer rota ou UI existir. Depois o wrapper da PageSpeed Insights, o cache por domínio, a agregação de nota. A UI só entrou depois que o backend inteiro já funcionava de ponta a ponta via curl.

Duas decisões valem registrar:

- A tela de "analisando" mostra progresso de verdade, não um spinner genérico: a rota `/api/analyze` é um stream (SSE) que emite um evento assim que cada checagem *realmente* termina, na ordem real de conclusão.
- Os achados do diagnóstico (ex: "falta a meta description") são gerados como código + parâmetros no backend, não como frase pronta. A tradução PT/EN vive inteira no cliente, então trocar de idioma no meio de um relatório não reprocessa nada — é só um re-render.

Uma revisão de segurança feita à mão nesta base pegou duas falhas reais: a proteção contra SSRF só validava a URL de entrada, não os redirects que os checks seguiam (um site malicioso podia redirecionar o fetch pra um IP interno); e o rate limit confiava no primeiro valor de `X-Forwarded-For`, que é justamente o valor que o cliente controla. As duas foram corrigidas e viraram parte da base.

## Stack

Next.js (App Router) + TypeScript + Tailwind. Sem banco de dados: cache de análise por domínio (6h) e rate limit por IP (10/hora), com Upstash Redis quando configurado (`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) ou um `Map` em memória como fallback pra desenvolvimento local — em produção serverless, sem Redis configurado, o rate limit vale só por instância, não globalmente.

## Rodando localmente

```bash
npm install
npm run dev
```

Precisa de `PAGESPEED_API_KEY` (Google PageSpeed Insights API) e `NEXT_PUBLIC_FORMSPREE_ENDPOINT` num `.env.local` — veja `.env.example`. `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` são opcionais (sem eles, cache e rate limit caem pro fallback em memória).

## Estrutura

```
app/
  api/analyze/route.ts    — rota SSE que orquestra as checagens e a PageSpeed API
  page.tsx                 — fluxo de estágios: início/análise, relatório, próximo passo
  components/               — HomeScreen + ScanPlan, ReportScreen + ScoreSummary + Findings, NextStepScreen
  i18n/                     — tradução PT/EN, inteira no cliente
lib/
  checks/                   — cada checagem própria isolada em arquivo
  pagespeed.ts, cache.ts, score.ts, issues.ts, rateLimit.ts, safeFetch.ts
```
