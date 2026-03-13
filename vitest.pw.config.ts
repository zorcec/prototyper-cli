import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/playwright/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    // Playwright must run serially — one real browser at a time
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
