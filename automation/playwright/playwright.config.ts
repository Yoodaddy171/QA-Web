import { defineConfig, devices } from '@playwright/test';

const workersFromEnv = Number(process.env.QA_PLAYWRIGHT_WORKERS || '1');

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  workers: Number.isFinite(workersFromEnv) && workersFromEnv > 0 ? workersFromEnv : 1,

  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },

  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: process.env.QA_BASE_URL || undefined,
    headless: process.env.QA_HEADLESS !== '0',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: process.env.QA_IGNORE_HTTPS_ERRORS === '1',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
