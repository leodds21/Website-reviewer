English | [Português (Brasil)](CONTRIBUTING.pt-BR.md)

# Contributing

Bug reports, fixes and small improvements are welcome.

## Issues

Open an [issue](https://github.com/leodds21/Website-reviewer/issues/new/choose) with the bug or feature template. For a bug, the URL you analyzed (if public), what you expected and what happened help most. Security problems go through [SECURITY.md](SECURITY.md), never a public issue.

## Pull requests

1. Fork and branch from `master` (`fix/sitemap-redirect`, `feat/open-graph-check`).
2. Set up as in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
3. Add tests for the behavior you change.
4. Run what CI runs: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.
5. Open the PR against `master` and fill in the template.

For anything bigger than a small fix, open an issue first.

## Guidelines

- One change per pull request.
- Commit subjects up to 50 characters, imperative, with a prefix (`fix:`, `feat:`, `docs:`…). A body only when the reason isn't obvious.
- Never report a problem the scanner couldn't verify; a check that can't tell should say so.
- User-facing text goes in `app/i18n/translations.ts`, in Portuguese and English.
- No secrets in code, tests or examples.

Contributions are licensed under the [MIT License](LICENSE) and follow the [code of conduct](CODE_OF_CONDUCT.md).
