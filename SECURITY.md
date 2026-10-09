English | [Português (Brasil)](SECURITY.pt-BR.md)

# Security policy

## Supported versions

Only the current `master` branch is supported. It's what runs at [scan.lsdias.dev](https://scan.lsdias.dev); there are no older releases to patch.

## Dependency status

`npm audit` currently reports one advisory chain, and it's development-only: the ESLint configuration (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`, already at its latest published version, 3.0.3). It runs only during `npm run lint`, on this repository's own file patterns, and isn't part of the deployed app. There is no patched release yet; the only fix npm offers is downgrading the Next.js lint config to an older major, which isn't worth it. Dependabot watches for a fix weekly.

## Reporting a vulnerability

Please **don't open a public issue** for a security problem.

Report it privately through GitHub: **[Report a vulnerability](https://github.com/leodds21/Website-reviewer/security/advisories/new)** (the "Security" tab → "Report a vulnerability"). Only the maintainer sees it.

A useful report includes what the problem is, how to reproduce it, and what an attacker could do with it.

## What to expect

This is a project maintained by one person, so responses are best effort. You can expect an acknowledgment within a few days, an assessment of the report, and, if it's confirmed, a fix and a note in the changelog. You'll be credited in the advisory if you'd like to be. There's no bug bounty.

## Scope

In scope:

- The application code in this repository
- The deployed app at scan.lsdias.dev, in particular its handling of the URLs it's asked to analyze (SSRF, redirects, private networks), the API's abuse limits, and anything that exposes secrets or other visitors' data

Out of scope:

- Problems the scanner reports about other websites (that's what it's for)
- Denial of service by traffic volume, and automated scanning that generates heavy load
- Vulnerabilities in third-party services the app uses (Vercel, Upstash, Google, Formspree); please report those to the provider

When testing against the live app, please stay within your own requests: don't degrade the service for others or try to access data that isn't yours.
