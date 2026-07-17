import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const baseURL = 'http://127.0.0.1:3000';
const databaseUrl = 'file:./db/e2e.db';

export default defineConfig({
  ...baseConfig,
  webServer: {
    command: 'npm run test:e2e:prepare && npm run start:standalone:test',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: databaseUrl,
      APP_URL: baseURL,
      QA_ALLOWED_ORIGINS: baseURL,
      HOSTNAME: '127.0.0.1',
      PORT: '3000',
      QA_COOKIE_SECURE: '0',
    },
  },
});
