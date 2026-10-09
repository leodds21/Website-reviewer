English | [Português (Brasil)](SECURITY.pt-BR.md)

# Security policy

Only the current `master` branch, which runs at [scan.lsdias.dev](https://scan.lsdias.dev), is supported.

## Reporting a vulnerability

Please don't open a public issue. Report it privately: **[Report a vulnerability](https://github.com/leodds21/Website-reviewer/security/advisories/new)** (Security tab). Include what the problem is, how to reproduce it and what an attacker could do with it.

This is maintained by one person, so responses are best effort: an acknowledgment within a few days, then an assessment and, if confirmed, a fix and a changelog note. You can be credited in the advisory. There's no bug bounty.

## Scope

In scope: the code in this repository and the live app, especially how it handles the URLs it analyzes (SSRF, redirects, private networks), its abuse limits, and anything that exposes secrets or other visitors' data.

Out of scope: problems the scanner reports about other sites, denial of service by traffic volume, and vulnerabilities in Vercel, Upstash, Google or Formspree (report those to the provider). When testing the live app, don't degrade it for others or try to access data that isn't yours.

## Known advisories

`npm audit` reports one dev-only chain in the ESLint config (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`). It only runs during `npm run lint` and isn't part of the deployed app. Dependabot checks for a fix weekly.
