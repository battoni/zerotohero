import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/db/**/*.test.ts'],
    // Pure units by default; opt into `// @vitest-environment nuxt` per file when a test needs the app.
    environment: 'node',
    hookTimeout: 60_000,
  },
})
