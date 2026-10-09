# Changelog

Notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

The project was developed privately before this first public release; that history is in the Git log, not repeated here.

## [0.1.0] — first public release

The state of the app as it was opened to the public:

- Analysis of a page's HTTPS and redirect, security headers, title, description, viewport, image alt text, sitemap/robots.txt, broken links and platform, plus Google PageSpeed Insights (mobile)
- Live progress over Server-Sent Events while the checks run in parallel
- Category and overall scores with "Understand this score", the measurements behind each score
- "Fix these first", findings ranked by severity and points lost, and "What's working"
- Shareable report links (cached reports only), print / save as PDF, Portuguese and English
- SSRF protection with connection-time DNS checks, per-IP rate limit, per-request CSP nonce
