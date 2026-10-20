import { defineConfig } from '@playwright/test';
import base from './playwright.phase8e.config';
import path from 'node:path';
import os from 'node:os';
const run = process.env.QA_EVIDENCE_PREVIEW_RUN || 'confirmed';
export default defineConfig({ ...base, testMatch: 'evidence-preview.spec.ts', timeout: 180000,
  outputDir: path.join(os.tmpdir(), 'qadesk-phase8e-20261019', 'test-results', `evidence-preview-${run}`),
  reporter: [['list'], ['json', { outputFile: path.join(os.tmpdir(), 'qadesk-phase8e-20261019', `evidence-preview-results-${run}.json`) }]],
});
