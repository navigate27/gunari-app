import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
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