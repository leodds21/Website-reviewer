# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions: [Semantic Versioning](https://semver.org/). Earlier history is in the Git log.

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
