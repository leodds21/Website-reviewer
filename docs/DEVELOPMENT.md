English | [Português (Brasil)](DEVELOPMENT.pt-BR.md)

# Development

## Setup

Requires Node.js 22.19+ (for `undici`) and npm.

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000, redirects to /pt-BR or /en
```

Every variable is optional:

- without `PAGESPEED_API_KEY`, Google's parts show as "not measured";
- without Upstash, the cache, rate limit, locks and shared reports live in memory, per server process;
- `REPORT_TTL_DAYS` sets how long shared report links last (default 30);
- `BATCH_TOKEN` turns on the batch page; without it, every access code is refused.

[`.env.example`](../.env.example) lists them all.

## Routes

| Path | What |
|---|---|
| `/` | Redirects to the visitor's language (`?lang=`, cookie, `Accept-Language`) |
| `/pt-BR`, `/en` | Home: form, progress, report, next step |
| `/pt-BR/report/<id>`, `/en/report/<id>` | A shared report, rendered on the server; expired ids show an expired page |
| `/pt-BR/batch`, `/en/batch` | Batch analysis with `BATCH_TOKEN`; `noindex` and not linked |
| `/api/analyze?url=` | The analysis stream |

The files for each language are thin wrappers over `app/_shared/`. A change there applies to both.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen`, then `tsc --noEmit` (typed routes included) |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright, against a production build on port 3210 |
| `npm run analyze` | Next's bundle analyzer (`--output` writes to `.next/diagnostics/analyze`) |
| `npm run check:bundle` | After a build: each page's initial JS (gzip) against its budget, and one dictionary per language |

The budgets in `scripts/check-bundle.mjs` are the measured sizes plus about 5%. If a change raises one on purpose, update the number in the same pull request and say why.

## Tests

- **Vitest** tests sit next to the code:
  - network and DNS are stubbed, and `vitest.setup.ts` routes undici's `fetch` through the global one so the stubs apply;
  - hook tests use `// @vitest-environment jsdom`;
  - `lib/scoreScenarios.ts` pins the exact scores of four sample sites.
- **Playwright** (`e2e/`) runs the real build on desktop Chrome and a 360px phone. First run: `npx playwright install chromium`.
  - `mockAnalysis` answers `/api/analyze` with a whole stream.
  - `mockLiveAnalysis` plus `sendAnalysisEvent` feed it event by event, to see the partial report before the final one.
  - The server talks to `e2e/fakeUpstash.mjs`, a small stand-in for Upstash's REST API that Playwright starts on port 3299. `seedSharedReport` stores a report there, so `/pt-BR/report/<id>` renders it for real.
- **CI** runs lint, typecheck, tests, build, `check:bundle` and e2e on every pull request and push to `master`.

## Conventions

- **Commits:** small, with a subject of up to 50 characters in the imperative (`fix:`, `feat:`, `docs:`, `chore:`…). Add a body only when the reason isn't obvious.
- **Checks:** one file each in `lib/checks/`. Fetching goes through `safeFetch`; parsers take the HTML already fetched.
- **Findings:** a code plus parameters; the wording lives in `app/i18n/dictionaries/pt-BR.ts` and `en.ts`.
- **Comments:** only for a "why" the code doesn't show.
- **Formatting:** no formatter; follow the surrounding code.

## Adding a check

1. Add `lib/checks/<name>.ts` and its test.
2. Add its result to `lib/checkResults.ts`.
   - A parser over the page already fetched runs in the `page` branch of `lib/runAnalysis.ts`; the response headers come with the HTML.
   - A check with its own request also needs a key in `CheckKey` (`lib/checkFailure.ts`), a task in `lib/runAnalysis.ts`, `TASK_STEPS` there and `lib/scanSteps.ts`, and `OWN_TASKS` if the partial report should wait for it.
3. If it costs points: a measurement in `lib/score.ts`, a finding in `lib/issues.ts`, and the link in `COMPONENT_ISSUES`. If it can pass: `lib/passes.ts`.
4. Add the copy to both dictionaries.

## Debugging

- **Server errors** go to the `npm run dev` terminal.
- **The raw stream:** `curl -N "http://localhost:3000/api/analyze?url=example.com"` prints `step`, `partial` and `done` as they arrive.
- **Shared reports locally:** run an analysis, then open the `/pt-BR/report/<id>` address it moves to. Without Redis the report lives in that server process's memory, so restarting `npm run dev` expires it.
- **Redis without Upstash:** `node e2e/fakeUpstash.mjs 3299`, then start the app with `UPSTASH_REDIS_REST_URL=http://localhost:3299` and `UPSTASH_REDIS_REST_TOKEN=local`. The fake stores only what the shared reports, the cache and the locks use.
- **Coalescing:** start two `curl -N` requests for the same uncached URL a second apart. Both end with the same `checkedAt`, from one run.
- **Batch:** set `BATCH_TOKEN` in `.env.local` and open `/pt-BR/batch`, or `curl -N -H "Authorization: Bearer <token>" "http://localhost:3000/api/analyze?url=example.com"`.
- **Print:** Ctrl+P on a report. The page footer needs Chrome 131+.
- **Languages:** `/pt-BR` and `/en` directly, or `/` with a different `Accept-Language` or `?lang=en`. The choice is stored in the `isdias-lang` cookie.
