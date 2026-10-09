[English](SECURITY.md) | Português (Brasil)

# Política de segurança

## Versões suportadas

Só a branch `master` atual é suportada. É ela que roda em [scan.lsdias.dev](https://scan.lsdias.dev); não há versões antigas para corrigir.

## Situação das dependências

O `npm audit` aponta hoje uma única cadeia de alertas, e ela é só de desenvolvimento: a configuração do ESLint (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`, já na última versão publicada, 3.0.3). Ela roda só no `npm run lint`, sobre os padrões de arquivo deste repositório, e não faz parte do app publicado. Ainda não existe versão corrigida; a única correção que o npm oferece é rebaixar a configuração de lint do Next.js para uma versão major antiga, o que não compensa. O Dependabot procura uma correção toda semana.

## Como reportar uma vulnerabilidade

Por favor, **não abra uma issue pública** para um problema de segurança.

Reporte de forma privada pelo GitHub: **[Report a vulnerability](https://github.com/leodds21/Website-reviewer/security/advisories/new)** (aba "Security" → "Report a vulnerability"). Só o mantenedor vê.

Um bom reporte diz qual é o problema, como reproduzir e o que um atacante conseguiria fazer com ele.

## O que esperar

Este é um projeto mantido por uma pessoa, então as respostas são feitas no melhor esforço possível. Você pode esperar uma confirmação de recebimento em alguns dias, uma avaliação do reporte e, se ele for confirmado, uma correção e uma nota no changelog. Se quiser, você recebe crédito no aviso de segurança. Não há programa de recompensa.

## Escopo

Dentro do escopo:

- O código da aplicação neste repositório
- O app publicado em scan.lsdias.dev, em especial o tratamento das URLs que ele analisa (SSRF, redirecionamentos, redes privadas), os limites contra abuso da API e qualquer coisa que exponha segredos ou dados de outros visitantes

Fora do escopo:

- Problemas que o scanner aponta em outros sites (é para isso que ele existe)
- Negação de serviço por volume de tráfego e varreduras automáticas que geram carga pesada
- Vulnerabilidades nos serviços de terceiros usados pelo app (Vercel, Upstash, Google, Formspree); reporte essas ao fornecedor

Ao testar contra o app publicado, fique nas suas próprias requisições: não degrade o serviço para outras pessoas nem tente acessar dados que não são seus.
