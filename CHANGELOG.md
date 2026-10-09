# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions: [Semantic Versioning](https://semver.org/). Earlier history is in the Git log.

## [0.1.0] - first public release

- Checks for HTTPS and redirect, security headers, title, description, viewport, alt text, sitemap/robots.txt, broken links and platform, plus PageSpeed Insights (mobile)
- Live progress over Server-Sent Events while checks run in parallel
- Explainable scores, "Fix these first", findings by severity and "What's working"
- Shareable report links, print / save as PDF, Portuguese and English
- SSRF protection with connection-time DNS checks, per-IP rate limit, per-request CSP nonce

### Security

- Next.js 16.4.0, which fixes a critical advisory in 16.3.0
