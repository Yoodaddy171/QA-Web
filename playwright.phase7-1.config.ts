import { defineConfig } from '@playwright/test';
import phase7 from './playwright.phase7.config';

// Same isolated production server, fixtures, browser, one worker and zero retries.
export default defineConfig({ ...phase7, testMatch: 'phase7-1.acceptance.spec.ts' });
