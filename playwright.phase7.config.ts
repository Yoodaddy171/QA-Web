import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
const root = process.env.QA_PHASE7_ROOT;
const run = process.env.QA_PHASE7_RUN || 'smoke';
if (!/^[a-z0-9-]+$/.test(run)) throw new Error('Safe unique run label required');
if (!root || !path.basename(root).startsWith('qadesk-phase7-')) throw new Error('Explicit synthetic Phase7 root required');
export default defineConfig({
  testDir: './e2e', testMatch: 'phase7.acceptance.spec.ts', workers: 1, fullyParallel: false, retries: 0,
  timeout: 60000, expect: { timeout: 10000 }, outputDir: path.join(root,`browser-artifacts-${run}`),
  reporter: [['list'],['json',{outputFile:path.join(root,`browser-results-${run}.json`)}]],
  use: { ...devices['Desktop Chrome'], actionTimeout:10000, navigationTimeout:20000, viewport:{width:1440,height:900}, baseURL:'http://127.0.0.1:3119', trace:'retain-on-failure', screenshot:'only-on-failure', extraHTTPHeaders:{Origin:'http://127.0.0.1:3119'} },
});
