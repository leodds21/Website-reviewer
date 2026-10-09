English | [Português (Brasil)](CONTRIBUTING.pt-BR.md)

# Contributing

Thanks for taking the time. Bug reports, fixes and small improvements are all welcome.

## Reporting a bug or suggesting something

Open an [issue](https://github.com/leodds21/Website-reviewer/issues/new/choose) using the bug report or feature request template. For a bug, the URL you analyzed (if it's public), what you expected and what happened help the most.

Security problems go through [SECURITY.md](SECURITY.md), never a public issue.

## Making a change

1. Fork the repository and create a branch from `master`, named after the change (`fix/sitemap-redirect`, `feat/open-graph-check`).
2. Set up the project as described in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
3. Make the change, with tests for any behavior it adds or fixes.
4. Run the same checks CI runs:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   npm run test:e2e
   ```

5. Open a pull request against `master` and fill in the template: what changed, why, and how you tested it.

For anything bigger than a small fix, open an issue first so we can agree on the approach before you spend time on it.

## What a good change looks like

- **Small and focused**: one change per pull request.
- **Commits**: a light [Conventional Commits](https://www.conventionalcommits.org/) style (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), with a body explaining what changed and why.
- **Honest results**: the scanner never reports a problem it couldn't verify. A check that can't tell should say so, not guess.
- **Both languages**: any text shown to users goes in `app/i18n/translations.ts`, in Portuguese and English.
- **No secrets** in code, tests or examples.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE) and that you'll follow the [code of conduct](CODE_OF_CONDUCT.md).
