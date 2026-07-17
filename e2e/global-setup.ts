import { request, type FullConfig } from '@playwright/test';
import fs from 'node:fs/promises';

export default async function globalSetup(config: FullConfig) {
  const baseURL = String(config.projects[0]?.use.baseURL || 'http://127.0.0.1:3000');
  await fs.mkdir('e2e/.auth', { recursive: true });
  const context = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const response = await context.post('/api/auth/login', {
    data: { email: 'owner@qa-desk.test', password: 'E2E-only-password-2026!' },
  });
  if (!response.ok()) {
    throw new Error(`E2E login gagal (${response.status()}): ${await response.text()}`);
  }
  await context.storageState({ path: 'e2e/.auth/user.json' });
  await context.dispose();
}
