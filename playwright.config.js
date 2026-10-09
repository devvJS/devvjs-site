import { defineConfig, devices } from '@playwright/test'

// Port 4180 only: 3000, 3001 and 3100 belong to the owner.
const PORT = 4180

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && PORT=${PORT} TRACKER_URL=http://127.0.0.1:9 node server.js`,
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 120000,
  },
})
