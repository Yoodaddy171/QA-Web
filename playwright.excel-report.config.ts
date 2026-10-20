import { defineConfig } from '@playwright/test';
import base from './playwright.phase8e.config';
import path from 'node:path';
import os from 'node:os';
const run = process.env.QA_EXCEL_REPORT_RUN || 'initial';
export default defineConfig({ ...base, testMatch: 'excel-report.spec.ts', timeout: 180000,
  outputDir: path.join(os.tmpdir(), 'qadesk-phase8e-20261019', 'test-results', `excel-report-${run}`),
  reporter: [['list'], ['json', { outputFile: path.join(os.tmpdir(), 'qadesk-phase8e-20261019', `excel-report-results-${run}.json`) }]],
});
