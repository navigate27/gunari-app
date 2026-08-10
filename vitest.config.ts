import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    include: [
      "packages/**/tests/**/*.test.ts",
      "src/**/*.test.{ts,tsx}",
    ],
    exclude: ["packages/**/tests/**/*.golden.test.ts"],
    environment: "node",
    testTimeout: 10000,
    setupFiles: ["src/test/setup.ts"],
  },
});