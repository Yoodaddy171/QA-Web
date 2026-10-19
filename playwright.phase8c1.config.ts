import { defineConfig } from '@playwright/test';
import phase7 from './playwright.phase7.config';
export default defineConfig({
  ...phase7,
  testMatch: 'phase8c1.inspector.spec.ts',
  use: { ...phase7.use, contextOptions: { reducedMotion: 'reduce', deviceScaleFactor: 1 } },
});
