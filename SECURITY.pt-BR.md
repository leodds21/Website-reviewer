[English](SECURITY.md) | Português (Brasil)

# Política de segurança

Só a branch `master` atual, que roda em [scan.lsdias.dev](https://scan.lsdias.dev), é suportada.

## Como reportar uma vulnerabilidade

Por favor, não abra uma issue pública. Reporte de forma privada: **[Report a vulnerability](https://github.com/leodds21/Website-reviewer/security/advisories/new)** (aba Security). Diga qual é o problema, como reproduzir e o que um atacante conseguiria fazer com ele.

O projeto é mantido por uma pessoa, então as respostas são no melhor esforço: confirmação em alguns dias, depois uma avaliação e, se confirmado, uma correção e uma nota no changelog. Se quiser, você recebe crédito no aviso. Não há programa de recompensa.

## Escopo

Dentro: o código deste repositório e o app publicado, em especial o tratamento das URLs analisadas (SSRF, redirecionamentos, redes privadas), os limites contra abuso e qualquer coisa que exponha segredos ou dados de outros visitantes.

Fora: problemas que o scanner aponta em outros sites, negação de serviço por volume de tráfego e vulnerabilidades na Vercel, no Upstash, no Google ou no Formspree (reporte ao fornecedor). Ao testar o app publicado, não degrade o serviço para outras pessoas nem tente acessar dados que não são seus.

## Alertas conhecidos

O `npm audit` aponta uma cadeia só de desenvolvimento na configuração do ESLint (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`). Ela roda só no `npm run lint` e não faz parte do app publicado. O Dependabot procura uma correção toda semana.
