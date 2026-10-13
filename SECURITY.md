English | [Português (Brasil)](SECURITY.pt-BR.md)

# Security policy

Only the current `master` branch, which runs at [scan.lsdias.dev](https://scan.lsdias.dev), is supported.

## Reporting a vulnerability

Please don't open a public issue. Report it privately: **[Report a vulnerability](https://github.com/leodds21/Website-reviewer/security/advisories/new)** (Security tab). Include what the problem is, how to reproduce it and what an attacker could do with it.

This is maintained by one person, so responses are best effort: an acknowledgment within a few days, then an assessment and, if confirmed, a fix and a changelog note. You can be credited in the advisory. There's no bug bounty.

## Scope

In scope: the code in this repository and the live app, especially how it handles the URLs it analyzes (SSRF, redirects, private networks), its abuse limits, shared report links, and anything that exposes secrets or other visitors' data.

Out of scope: problems the scanner reports about other sites, denial of service by traffic volume, and vulnerabilities in Vercel, Upstash, Google or Formspree (report those to the provider). When testing the live app, don't degrade it for others or try to access data that isn't yours.

## Data the app keeps

| What | Where | For how long |
|---|---|---|
| Finished report and the analyzed URL, for its share link | Upstash (`report:<id>`) | `REPORT_TTL_DAYS`, default 30 days |
| Report cache, keyed by the analyzed origin and path | Upstash | 6 hours, 5 minutes when a check failed |
| Progress of an analysis in flight, for identical concurrent requests | Upstash | 2 minutes at most |
| Request times per IP, for the rate limit | Upstash | 1 hour |
| Language choice | `isdias-lang` cookie | 1 year |

No page HTML is stored. Report ids are 10 random base62 characters (about 59 bits) and are validated before any lookup. They can't be guessed, but anyone with the link can open the report, so a link should be shared like the report itself. Report pages and their preview images show only what the report shows, and they're marked `noindex`.

Vercel Speed Insights measures page speed (Core Web Vitals) without cookies. Report ids and the query string are removed from the URL before it's sent. When a check fails, the server log can include the analyzed URL. The browser only ever receives error codes.

## Known advisories

`npm audit` reports one dev-only chain in the ESLint config (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`). It only runs during `npm run lint` and isn't part of the deployed app. Dependabot checks for a fix weekly.
