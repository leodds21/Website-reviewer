English | [Português (Brasil)](DEVELOPMENT.pt-BR.md)

# Development

## Setup

Requires Node.js 22.19+ (for `undici`) and npm.

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

Every variable is optional. Without `PAGESPEED_API_KEY`, Google's parts show as "not measured"; without Upstash, cache and rate limit live in memory. [`.env.example`](../.env.example) lists them all.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen`, then `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright, against a production build on port 3210 |

## Tests

- **Vitest** tests sit next to the code. Network and DNS are stubbed, and `vitest.setup.ts` routes undici's `fetch` through the global one so the stubs apply. Hook tests use `// @vitest-environment jsdom`. `lib/scoreScenarios.ts` pins the exact scores of four sample sites.
- **Playwright** (`e2e/`) runs the real build with only the analysis endpoint mocked, on desktop Chrome and a 360px phone. First run: `npx playwright install chromium`.
- **CI** runs lint, typecheck, tests, build and e2e on every pull request and push to `master`.

## Conventions

- **Commits:** small, with a subject of up to 50 characters in the imperative (`fix:`, `feat:`, `docs:`, `chore:`…). Add a body only when the reason isn't obvious.
- **Checks:** one file each in `lib/checks/`. Fetching goes through `safeFetch`; parsers take the HTML already fetched.
- **Findings:** a code plus parameters; the wording lives in `app/i18n/translations.ts`, in both languages.
- **Comments:** only for a "why" the code doesn't show.
- **Formatting:** no formatter; follow the surrounding code.

## Adding a check

1. Add `lib/checks/<name>.ts` and its test.
2. Add its result to `lib/checkResults.ts`, its key to `CheckKey` in `lib/checkFailure.ts`, and run it from `app/api/analyze/route.ts` (plus `TASK_STEPS` and `lib/scanSteps.ts`).
3. If it costs points: a measurement in `lib/score.ts`, a finding in `lib/issues.ts`, and the link in `COMPONENT_ISSUES`. If it can pass: `lib/passes.ts`.
4. Add the copy in both languages.

## Debugging

Server errors go to the `npm run dev` terminal. To see the raw stream: `curl -N "http://localhost:3000/api/analyze?url=example.com"`. Restarting the dev server clears the in-memory cache.
