[English](DEVELOPMENT.md) | Português (Brasil)

# Desenvolvimento

## Instalação

Requer Node.js 22.19+ (por causa do `undici`) e npm.

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000, redireciona para /pt-BR ou /en
```

Todas as variáveis são opcionais:

- sem `PAGESPEED_API_KEY`, as partes do Google aparecem como "não medido";
- sem o Upstash, cache, limite, travas e relatórios compartilhados ficam em memória, por processo do servidor;
- `REPORT_TTL_DAYS` define quanto tempo os links de relatório duram (padrão 30).

O [`.env.example`](../.env.example) lista todas.

## Rotas

| Caminho | O quê |
|---|---|
| `/` | Redireciona para o idioma do visitante (`?lang=`, cookie, `Accept-Language`) |
| `/pt-BR`, `/en` | Início: formulário, progresso, relatório, próximo passo |
| `/pt-BR/report/<id>`, `/en/report/<id>` | Um relatório compartilhado, renderizado no servidor; IDs expirados mostram uma página de expirado |
| `/api/analyze?url=` | O stream da análise |

Os arquivos de cada idioma são invólucros finos sobre `app/_shared/`. Uma mudança lá vale para os dois.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` e depois `tsc --noEmit` (inclui as rotas tipadas) |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright, contra um build de produção na porta 3210 |
| `npm run analyze` | Analisador de bundle do Next (`--output` grava em `.next/diagnostics/analyze`) |
| `npm run check:bundle` | Depois de um build: o JS inicial de cada página (gzip) contra o orçamento, e um dicionário por idioma |

Os orçamentos em `scripts/check-bundle.mjs` são os tamanhos medidos mais cerca de 5%. Se uma mudança aumenta um deles de propósito, atualize o número no mesmo pull request e diga por quê.

## Testes

- **Vitest**: os testes ficam ao lado do código.
  - Rede e DNS são simulados, e o `vitest.setup.ts` faz o `fetch` do undici passar pelo global para as simulações valerem.
  - Testes de hooks usam `// @vitest-environment jsdom`.
  - O `lib/scoreScenarios.ts` fixa as notas exatas de quatro sites de exemplo.
- **Playwright** (`e2e/`): roda o build de verdade no Chrome desktop e num celular de 360px. Primeira execução: `npx playwright install chromium`.
  - `mockAnalysis` responde `/api/analyze` com o stream inteiro.
  - `mockLiveAnalysis` com `sendAnalysisEvent` manda evento por evento, para ver o relatório parcial antes do final.
  - O servidor conversa com `e2e/fakeUpstash.mjs`, uma imitação pequena da API REST do Upstash que o Playwright sobe na porta 3299. O `seedSharedReport` guarda um relatório lá, e `/pt-BR/report/<id>` o renderiza de verdade.
- **CI**: roda lint, typecheck, testes, build, `check:bundle` e e2e em todo pull request e push na `master`.

## Convenções

- **Commits:** pequenos, com título de até 50 caracteres no imperativo (`fix:`, `feat:`, `docs:`, `chore:`…). Corpo só quando o motivo não é óbvio.
- **Checagens:** uma por arquivo em `lib/checks/`. Buscas passam pelo `safeFetch`; parsers recebem o HTML já buscado.
- **Achados:** um código mais parâmetros; as frases ficam em `app/i18n/dictionaries/pt-BR.ts` e `en.ts`.
- **Comentários:** só para um "porquê" que o código não mostra.
- **Formatação:** sem formatador; siga o código ao redor.

## Adicionando uma checagem

1. Crie `lib/checks/<nome>.ts` e o teste dela.
2. Adicione o resultado em `lib/checkResults.ts`, a chave em `CheckKey` (`lib/checkFailure.ts`) e rode a checagem em `lib/runAnalysis.ts` (mais `TASK_STEPS` ali e `lib/scanSteps.ts`). Se for uma checagem própria, inclua em `OWN_TASKS` para o relatório parcial esperar por ela.
3. Se tira pontos: uma medição em `lib/score.ts`, um achado em `lib/issues.ts` e a ligação em `COMPONENT_ISSUES`. Se pode passar: `lib/passes.ts`.
4. Adicione os textos nos dois dicionários.

## Depuração

- **Erros do servidor** saem no terminal do `npm run dev`.
- **O stream cru:** `curl -N "http://localhost:3000/api/analyze?url=example.com"` mostra `step`, `partial` e `done` conforme chegam.
- **Relatórios compartilhados localmente:** rode uma análise e abra o endereço `/pt-BR/report/<id>` para onde ela vai. Sem Redis o relatório fica na memória daquele processo, então reiniciar o `npm run dev` faz ele expirar.
- **Redis sem Upstash:** `node e2e/fakeUpstash.mjs 3299` e depois suba o app com `UPSTASH_REDIS_REST_URL=http://localhost:3299` e `UPSTASH_REDIS_REST_TOKEN=local`. A imitação guarda só o que relatórios compartilhados, cache e travas usam.
- **Coalescing:** dispare dois `curl -N` para a mesma URL fora do cache, com um segundo de diferença. Os dois terminam com o mesmo `checkedAt`, de uma única execução.
- **Idiomas:** `/pt-BR` e `/en` direto, ou `/` com outro `Accept-Language` ou `?lang=en`. A escolha fica no cookie `isdias-lang`.
