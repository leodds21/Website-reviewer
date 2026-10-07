import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  test: {
    // Default stays node — fastest for the plain .test.ts files, which
    // are the majority and never touch the DOM. Hook tests that need
    // one opt in per-file via a `// @vitest-environment jsdom` comment.
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
