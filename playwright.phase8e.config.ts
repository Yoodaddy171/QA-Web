import { defineConfig } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
const run = process.env.QA_PHASE8E_RUN || 'candidate';
export default defineConfig({
  testDir: './e2e', testMatch: 'phase8e.graph.spec.ts', workers: 1, retries: 0,
  timeout: 45000, expect: { timeout: 12000 }, fullyParallel: false,
  outputDir: path.join(os.tmpdir(), 'qadesk-phase8e-20261019', 'test-results', run),
  reporter: [['list'], ['json', { outputFile: path.join(os.tmpdir(), 'qadesk-phase8e-20261019', `browser-results-${run}.json`) }]],
  use: { baseURL: 'http://127.0.0.1:3127', browserName: 'chromium', viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'reduce', deviceScaleFactor: 1 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
