import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unicorn from "eslint-plugin-unicorn";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // lib/ only: app/ has PascalCase components and Next's own file names.
    files: ["lib/**/*.ts"],
    plugins: { unicorn },
    rules: {
      "unicorn/filename-case": ["error", { case: "camelCase" }],
    },
  },
  // eslint-config-next's default ignores, plus test output and a local-only folder.
  globalIgnores([
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
