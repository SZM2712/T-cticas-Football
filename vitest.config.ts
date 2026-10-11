import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "tools/*/test/**/*.test.ts"],
    testTimeout: 60_000,
    // La preparación de algunos tests simula varias temporadas; en la CI tarda más que en local.
    hookTimeout: 180_000,
    coverage: { include: ["packages/*/src/**"] },
  },
});
