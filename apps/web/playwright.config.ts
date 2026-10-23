import { defineConfig, devices } from '@playwright/test';

// Runs against a running sandbox: docker compose up (http://localhost:8080), or the dev server
// with E2E_BASE_URL=http://localhost:5173. Tests reset the sandbox before each test, so they run one at a time.
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  },
});
