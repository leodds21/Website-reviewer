import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unicorn from "eslint-plugin-unicorn";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Scoped to lib/ only: app/ has its own legitimate, conflicting
    // conventions (PascalCase React components, Next.js-mandated
    // filenames like opengraph-image.tsx) that camelCase would wrongly
    // flag. lib/ used to mix camelCase (fetchHtml.ts, rateLimit.ts) with
    // kebab-case (lib/checks/*.ts) — camelCase won since every
    // multi-word file outside lib/checks/ already used it.
    files: ["lib/**/*.ts"],
    plugins: { unicorn },
    rules: {
      "unicorn/filename-case": ["error", { case: "camelCase" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "diagn-stico-de-site/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
