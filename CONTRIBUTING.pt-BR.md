[English](CONTRIBUTING.md) | Português (Brasil)

# Contribuindo

Obrigado pelo tempo. Reportes de bug, correções e pequenas melhorias são todos bem-vindos.

## Reportando um bug ou sugerindo algo

Abra uma [issue](https://github.com/leodds21/Website-reviewer/issues/new/choose) usando o template de bug ou de sugestão. Num bug, ajudam mais a URL analisada (se for pública), o que você esperava e o que aconteceu.

Problemas de segurança vão pelo [SECURITY.pt-BR.md](SECURITY.pt-BR.md), nunca por issue pública.

## Fazendo uma mudança

1. Faça um fork do repositório e crie uma branch a partir da `master`, com o nome da mudança (`fix/sitemap-redirect`, `feat/open-graph-check`).
2. Prepare o projeto como descrito em [docs/DEVELOPMENT.pt-BR.md](docs/DEVELOPMENT.pt-BR.md).
3. Faça a mudança, com testes para qualquer comportamento que ela adiciona ou corrige.
4. Rode as mesmas verificações que o CI roda:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   npm run test:e2e
   ```

5. Abra um pull request para a `master` e preencha o template: o que mudou, por quê e como você testou.

Para algo maior que uma correção pequena, abra uma issue antes, para combinarmos o caminho antes de você investir tempo nisso.

## O que é uma boa mudança

- **Pequena e focada**: uma mudança por pull request.
- **Commits**: um estilo leve de [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), com um corpo explicando o que mudou e por quê.
- **Resultados honestos**: o scanner nunca aponta um problema que não conseguiu verificar. Uma checagem que não sabe deve dizer isso, não chutar.
- **Os dois idiomas**: qualquer texto exibido ao usuário vai em `app/i18n/translations.ts`, em português e inglês.
- **Nada de segredos** em código, testes ou exemplos.

Ao contribuir, você concorda que suas contribuições ficam sob a [licença MIT](LICENSE) e que vai seguir o [código de conduta](CODE_OF_CONDUCT.md).
