import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/tests/**/*.golden.test.ts"],
    environment: "node",
    testTimeout: 60000,
  },
});