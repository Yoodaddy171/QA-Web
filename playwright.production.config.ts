import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';
import path from 'node:path';

const port = Number(process.env.QA_E2E_PORT || 3100);
if (!Number.isInteger(port) || port < 3100 || port > 65535) throw new Error('QA_E2E_PORT must be an isolated port >= 3100');
const baseURL = `http://127.0.0.1:${port}`;
const databaseUrl = `file:${path.resolve('prisma/db/e2e.db').replaceAll('\\', '/')}`;

export default defineConfig({
  ...baseConfig,
  outputDir: process.env.QA_E2E_OUTPUT_DIR || baseConfig.outputDir,
  use: { ...baseConfig.use, baseURL, extraHTTPHeaders: { Origin: baseURL } },
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
      PORT: String(port),
      QA_COOKIE_SECURE: '0',
    },
  },
});
