[English](CONTRIBUTING.md) | Português (Brasil)

# Contribuindo

Reportes de bug, correções e pequenas melhorias são bem-vindos.

## Issues

Abra uma [issue](https://github.com/leodds21/Website-reviewer/issues/new/choose) com o template de bug ou de sugestão. Num bug, ajudam mais a URL analisada (se for pública), o que você esperava e o que aconteceu. Problemas de segurança vão pelo [SECURITY.pt-BR.md](SECURITY.pt-BR.md), nunca por issue pública.

## Pull requests

1. Faça um fork e crie uma branch a partir da `master` (`fix/sitemap-redirect`, `feat/open-graph-check`).
2. Prepare o projeto como em [docs/DEVELOPMENT.pt-BR.md](docs/DEVELOPMENT.pt-BR.md).
3. Adicione testes para o comportamento que mudar.
4. Rode o que o CI roda: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.
5. Abra o PR para a `master` e preencha o template.

Para algo maior que uma correção pequena, abra uma issue antes.

## Diretrizes

- Uma mudança por pull request.
- Títulos de commit com até 50 caracteres, no imperativo, com prefixo (`fix:`, `feat:`, `docs:`…). Corpo só quando o motivo não é óbvio.
- O scanner nunca aponta um problema que não conseguiu verificar; uma checagem que não sabe deve dizer isso.
- Texto exibido ao usuário vai em `app/i18n/translations.ts`, em português e inglês.
- Nada de segredos em código, testes ou exemplos.

As contribuições ficam sob a [licença MIT](LICENSE) e seguem o [código de conduta](CODE_OF_CONDUCT.md).
