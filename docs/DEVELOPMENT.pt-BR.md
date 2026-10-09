[English](DEVELOPMENT.md) | Português (Brasil)

# Desenvolvimento

## Instalação

Requer Node.js 22.19+ (por causa do `undici`) e npm.

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

Todas as variáveis são opcionais. Sem `PAGESPEED_API_KEY`, as partes do Google aparecem como "não medido"; sem o Upstash, cache e limite ficam em memória. O [`.env.example`](../.env.example) lista todas.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` e depois `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright, contra um build de produção na porta 3210 |

## Testes

- **Vitest**: os testes ficam ao lado do código. Rede e DNS são simulados, e o `vitest.setup.ts` faz o `fetch` do undici passar pelo global para as simulações valerem. Testes de hooks usam `// @vitest-environment jsdom`. O `lib/scoreScenarios.ts` fixa as notas exatas de quatro sites de exemplo.
- **Playwright** (`e2e/`): roda o build de verdade, simulando só o endpoint da análise, no Chrome desktop e num celular de 360px. Primeira execução: `npx playwright install chromium`.
- **CI**: roda lint, typecheck, testes, build e e2e em todo pull request e push na `master`.

## Convenções

- **Commits:** pequenos, com título de até 50 caracteres no imperativo (`fix:`, `feat:`, `docs:`, `chore:`…). Corpo só quando o motivo não é óbvio.
- **Checagens:** uma por arquivo em `lib/checks/`. Buscas passam pelo `safeFetch`; parsers recebem o HTML já buscado.
- **Achados:** um código mais parâmetros; as frases ficam em `app/i18n/translations.ts`, nos dois idiomas.
- **Comentários:** só para um "porquê" que o código não mostra.
- **Formatação:** sem formatador; siga o código ao redor.

## Adicionando uma checagem

1. Crie `lib/checks/<nome>.ts` e o teste dela.
2. Adicione o resultado em `lib/checkResults.ts`, a chave em `CheckKey` (`lib/checkFailure.ts`) e rode a checagem em `app/api/analyze/route.ts` (mais `TASK_STEPS` e `lib/scanSteps.ts`).
3. Se tira pontos: uma medição em `lib/score.ts`, um achado em `lib/issues.ts` e a ligação em `COMPONENT_ISSUES`. Se pode passar: `lib/passes.ts`.
4. Adicione os textos nos dois idiomas.

## Depuração

Erros do servidor saem no terminal do `npm run dev`. Para ver o stream cru: `curl -N "http://localhost:3000/api/analyze?url=example.com"`. Reiniciar o servidor de desenvolvimento limpa o cache em memória.
