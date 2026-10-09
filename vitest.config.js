import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
    exclude: ['**/node_modules/**', 'e2e/**', 'dist/**'],
    testTimeout: 15000,
  },
})
