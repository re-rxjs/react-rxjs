import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true, // needed for testing-library to cleanup between tests
    coverage: {
      reporter: ["lcov", "html"],
    },
  },
})
