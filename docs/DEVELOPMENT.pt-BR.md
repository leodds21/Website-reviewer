[English](DEVELOPMENT.md) | Português (Brasil)

# Desenvolvimento

## Instalação

Requisitos: Node.js 22.19 ou mais novo (a dependência `undici` exige) e npm.

```bash
git clone https://github.com/leodds21/Website-reviewer.git
cd Website-reviewer
npm install
cp .env.example .env.local
npm run dev
```

O app roda em [http://localhost:3000](http://localhost:3000) com todas as variáveis vazias:

- sem `PAGESPEED_API_KEY`: as partes medidas pelo Google aparecem como "não medido" (uma chave gratuita sai do console do Google Cloud, API PageSpeed Insights);
- sem `NEXT_PUBLIC_FORMSPREE_ENDPOINT`: o formulário de contato avisa que não está configurado;
- sem as variáveis do Upstash: cache e limite ficam em memória e zeram ao reiniciar.

O [`.env.example`](../.env.example) descreve cada variável.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com recarga automática |
| `npm run build` | Build de produção |
| `npm start` | Serve o build de produção |
| `npm run lint` | ESLint (regras core-web-vitals e TypeScript do Next, nomes de arquivo em camelCase em `lib/`) |
| `npm run typecheck` | `next typegen` (tipos das rotas) e depois `tsc --noEmit` |
| `npm test` | Vitest, uma vez |
| `npm run test:e2e` | Playwright; faz o build e serve o app na porta 3210 antes |

## Testes

**Vitest** (`*.test.ts` / `*.test.tsx`, ao lado do código que testam):

- As checagens rodam contra `fetch` e DNS simulados; nenhum teste acessa a rede.
- O `vitest.setup.ts` faz o `fetch` do `undici` (usado pelo `lib/safeFetch.ts`) passar pelo global, para essas simulações valerem em todo lugar.
- Testes de hooks usam jsdom com um comentário `// @vitest-environment jsdom`; o resto roda em Node.
- O `lib/scoreScenarios.ts` tem quatro entradas representativas (bom, médio, ruim, bloqueado) com as notas exatas fixadas, para nenhuma mudança na nota passar despercebida.

**Playwright** (`e2e/`):

- Roda o app de verdade (build de produção) e simula só o endpoint da análise, pelas fixtures em `e2e/fixtures.ts`.
- Dois projetos: Chrome desktop e uma tela de celular de 360px.
- Primeira execução local: `npx playwright install chromium`.
- Um teste só: `npx playwright test -g "parte do nome do teste"`.

**CI** (`.github/workflows/ci.yml`) roda lint, typecheck, testes unitários, build e a suíte e2e em todo push na `master` e todo pull request.

## Convenções

- **Commits**: pequenos e específicos, num estilo leve de [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), com um corpo que diz o que mudou e por quê.
- **Checagens**: uma por arquivo em `lib/checks/`. Uma checagem que busca algo passa pelo `safeFetch`; um parser recebe o HTML já buscado.
- **Achados**: um código mais parâmetros, nunca texto pronto; as frases ficam em `app/i18n/translations.ts`, nos dois idiomas.
- **Comentários**: só onde a decisão não é óbvia pelo código.
- **Formatação**: não há formatador configurado; siga o estilo do código ao redor (dois espaços, aspas duplas, linhas de até uns 140 caracteres).

## Adicionando uma checagem

1. Crie `lib/checks/<nome>.ts` (e o teste dela). Busque via `safeFetch` com tempo limite, ou escreva um parser puro do HTML da página.
2. Adicione o tipo do resultado em `lib/checkResults.ts`, a chave dela em `CheckKey` (`lib/checkFailure.ts`) e rode a checagem em `app/api/analyze/route.ts` (uma tarefa, mais a entrada em `TASK_STEPS` e em `lib/scanSteps.ts` para a tela de progresso).
3. Se ela deve tirar pontos, adicione uma medição em `lib/score.ts`, um achado em `lib/issues.ts` e, em `COMPONENT_ISSUES`, a ligação entre os dois. Se ela pode passar, adicione em `lib/passes.ts`.
4. Adicione os textos nos dois idiomas em `app/i18n/translations.ts`.

## Depuração

- Erros do servidor saem com `console.error` no terminal do `npm run dev` (em produção, nos logs da hospedagem). O navegador só recebe códigos de erro.
- Para ver o stream cru: `curl -N "http://localhost:3000/api/analyze?url=example.com"`.
- O cache guarda um relatório por 6 horas. Localmente, sem Upstash, reiniciar o servidor de desenvolvimento limpa o cache.
