import { defineConfig, devices } from '@playwright/test';
const baseURL = 'http://127.0.0.1:3000';
const databaseUrl = 'file:./db/e2e.db';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // SQLite-backed local development shares one database between tests; serial
  // workers keep project creation/cleanup deterministic and avoid lock races.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    storageState: 'e2e/.auth/user.json',
    extraHTTPHeaders: { Origin: baseURL },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run test:e2e:prepare && npm run dev',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: databaseUrl,
      APP_URL: baseURL,
      QA_ALLOWED_ORIGINS: baseURL,
      QA_WEB_HOST: '127.0.0.1',
      QA_COOKIE_SECURE: '0',
    },
  },
});
