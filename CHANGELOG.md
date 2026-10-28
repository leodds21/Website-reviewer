# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions: [Semantic Versioning](https://semver.org/). Earlier history is in the Git log.

## [Unreleased]

### Changed

- Mixed content is critical when it includes scripts, styles, frames or forms, which browsers block; images and media alone stay at attention
- Mixed content counts each address once, so a file used four times reads as one
- An address sent from lsdias.dev's scanner section (`?url=…&from=portfolio`) comes in the field with the run button focused, without the older-link note; it still never runs on its own

### Added

- Structured data (schema.org `WebApplication`) on the home page, in each language

### Fixed

- Links on a page reached through a redirect resolved against the address asked for: `spacejam.com/1996` reported 9 of 10 links broken. `<base href>` is honored too
- The batch CSV could fail to download in Safari
- The batch list treated `/Contato` and `/contato` as the same page

### Security

- The PageSpeed API key goes in the `X-Goog-Api-Key` header instead of the URL, so it can't end up in logs or error messages
- The contact form has a hidden spam trap (`_gotcha`) that Formspree uses to drop bot submissions

## [0.3.1] - 2026-10-18

### Security

- Next.js 16.4.2, which fixes GHSA-673q-mjm6-r5xr, GHSA-2464-fhr4-w9xw and GHSA-p3m5-59mp-jv5r in 16.4.0; React 19.3.1

## [0.3.0] - 2026-10-14

### Added

- Checks for `noindex` (meta tag and `X-Robots-Tag`), robots.txt rules for Googlebot, Open Graph preview, structured data, page language, mixed content and favicon. A page blocked from Google counts as 0 in SEO; other scores don't change
- Batch analysis at `/<locale>/batch` with an access code (`BATCH_TOKEN`): up to 25 sites, two at a time, CSV export
- Printing a report gives a PDF with a branded cover, page footer and page numbers
- The lsdias.dev LD symbol in the header, report, favicon and preview images; preview images use the brand fonts

### Changed

- Report redesign: an opening with the domain, numbered parts, "Fix these first" highlighted, spacing on one scale, a branded closing
- The cache moved to `analysis:v3:`, so the new checks show up right away
- Dependabot groups Next and React updates

### Fixed

- Minified HTML (attributes without quotes) was misread: example.com was flagged as missing a viewport
- Lighthouse 13 renamed the viewport audit, so its fallback never fired
- A request that lost the race for an analysis lock was charged against the rate limit
- A page open during a deploy no longer breaks on codes from the newer server
- The printed report started with a blank page and printed the screen's toggles

## [0.2.1] - 2026-10-13

### Fixed

- Shared report pages no longer fail hydration when the visitor's time zone differs from the server's; the date is formatted in the browser
- Back and forward never show one analysis's report for another, and keep Next's router in sync with the address; a reload on the next step returns to the report
- A finished analysis no longer pulls back a visitor who left it
- After Google's measurement fails, waiting categories show as not measured instead of "measuring"; a report with nothing measurable shows no overall score instead of 0
- A run that takes over another's analysis stops at the request's deadline, so it can't hold the lock past its function
- A failed report save no longer produces a link only one server can open; a failed read shows a retry page instead of "expired"
- A fractional `REPORT_TTL_DAYS` no longer breaks every save
- The older-link note no longer scrolls on every keystroke and goes away once the address is edited
- Memory without Redis no longer grows with every analysis

### Security

- Redis errors are logged without the command (IPs, URLs, reports); Redis calls retry twice instead of five times

### Removed

- `lucide-react` (two inline icons instead)

## [0.2.0] - 2026-10-13

### Added

- Partial report over SSE: the report opens once the scanner's own checks finish (about 3 s) and Google's measurement completes it
- Shareable report links (`/pt-BR/report/<id>`, `/en/report/<id>`), kept 30 days (`REPORT_TTL_DAYS`), with an expired-report page
- A preview image per report: domain, overall score, categories and date
- Language routes `/pt-BR` and `/en`, with canonical, hreflang, `og:locale` and a localized sitemap
- Core Web Vitals from real visitors through Vercel Speed Insights, with report ids and queries stripped
- Localized 404 pages

### Changed

- Identical analyses at the same time share one run through a Redis lock. Followers relay its progress and aren't charged against the rate limit.
- Report and next step stay mounted in `<Activity>`; screen changes fade with `<ViewTransition>` (off under reduced motion)
- Score panel shows its categories in two columns when it's wide
- The cache moved to a new key format (`analysis:v2:`); `cached=only` was removed and older `?url=` links fill the field

### Performance

- Initial JS on the home page: 156.3 to 149.6 KB gzip (one dictionary per language, report screens loaded on demand and fetched when an analysis starts)
- PageSpeed (mobile) for `/pt-BR`: 98 performance, LCP 2.0 s, CLS 0

### Security

- Exactly one CSP per response: nonce for pages, static for everything else, checked by a unit test
- Report ids are random, validated before any lookup, and report pages are `noindex`

### Developer Experience

- `npm run analyze` (Next's bundle analyzer) and `npm run check:bundle` (initial JS budget, run in CI)
- Typed routes
- Browser tests run against a small fake Upstash (`e2e/fakeUpstash.mjs`) and can stream events one at a time

## [0.1.0] - first public release

- Checks for HTTPS and redirect, security headers, title, description, viewport, alt text, sitemap/robots.txt, broken links and platform, plus PageSpeed Insights (mobile)
- Live progress over Server-Sent Events while checks run in parallel
- Explainable scores, "Fix these first", findings by severity and "What's working"
- Shareable report links, print / save as PDF, Portuguese and English
- SSRF protection with connection-time DNS checks, per-IP rate limit, per-request CSP nonce

### Security

- Next.js 16.4.0, which fixes a critical advisory in 16.3.0
