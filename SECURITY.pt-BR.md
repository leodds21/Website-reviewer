[English](SECURITY.md) | Português (Brasil)

# Política de segurança

Só a branch `master` atual, que roda em [scan.lsdias.dev](https://scan.lsdias.dev), é suportada.

## Como reportar uma vulnerabilidade

Por favor, não abra uma issue pública. Reporte de forma privada: **[Report a vulnerability](https://github.com/leodds21/Website-reviewer/security/advisories/new)** (aba Security). Diga qual é o problema, como reproduzir e o que um atacante conseguiria fazer com ele.

O projeto é mantido por uma pessoa, então as respostas são no melhor esforço: confirmação em alguns dias, depois uma avaliação e, se confirmado, uma correção e uma nota no changelog. Se quiser, você recebe crédito no aviso. Não há programa de recompensa.

## Escopo

Dentro: o código deste repositório e o app publicado, em especial o tratamento das URLs analisadas (SSRF, redirecionamentos, redes privadas), os limites contra abuso, os links de relatório compartilhado e qualquer coisa que exponha segredos ou dados de outros visitantes.

Fora: problemas que o scanner aponta em outros sites, negação de serviço por volume de tráfego e vulnerabilidades na Vercel, no Upstash, no Google ou no Formspree (reporte ao fornecedor). Ao testar o app publicado, não degrade o serviço para outras pessoas nem tente acessar dados que não são seus.

## Dados que o app guarda

| O quê | Onde | Por quanto tempo |
|---|---|---|
| Relatório pronto e a URL analisada, para o link de compartilhamento | Upstash (`report:<id>`) | `REPORT_TTL_DAYS`, padrão 30 dias |
| Cache de relatórios, pela origem e caminho analisados | Upstash | 6 horas, 5 minutos quando uma checagem falhou |
| Progresso de uma análise em andamento, para requisições iguais simultâneas | Upstash | No máximo 2 minutos |
| Horários das requisições por IP, para o limite de uso | Upstash | 1 hora |
| Idioma escolhido | Cookie `isdias-lang` | 1 ano |

O HTML das páginas não é guardado. Os IDs de relatório são 10 caracteres base62 aleatórios (cerca de 59 bits) e são validados antes de qualquer leitura. Não dá para adivinhá-los, mas quem tem o link abre o relatório, então o link deve ser compartilhado como o próprio relatório. As páginas de relatório e suas imagens de prévia mostram só o que o relatório mostra, e são marcadas como `noindex`.

O Vercel Speed Insights mede a velocidade das páginas (Core Web Vitals) sem cookies. O ID do relatório e a query string saem da URL antes do envio. Quando uma checagem falha, o log do servidor pode incluir a URL analisada. Os erros do Redis vão para o log sem o comando que carregam, para IPs e relatórios não durarem nos logs mais que o próprio prazo. O navegador só recebe códigos de erro.

## Acesso ao lote

`/pt-BR/batch` e `/en/batch` rodam uma lista de análises com o código de acesso de `BATCH_TOKEN`. O código só libera o limite por IP: a validação da URL, a proteção contra SSRF, o cache e as travas continuam iguais. Um código errado recebe `401`. O servidor compara os códigos em tempo constante e nunca os registra no log, e sem `BATCH_TOKEN` recusa qualquer código. O navegador guarda o código no `sessionStorage`, só naquela aba.

## Alertas conhecidos

O `npm audit` aponta uma cadeia só de desenvolvimento na configuração do ESLint (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`). Ela roda só no `npm run lint` e não faz parte do app publicado. O Dependabot procura uma correção toda semana.
