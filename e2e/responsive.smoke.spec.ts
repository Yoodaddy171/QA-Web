import { expect, test } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'laptop-1024', width: 1024, height: 768 },
  { name: 'mobile-390', width: 390, height: 844 },
];

test('dashboard remains readable without horizontal page overflow at target viewports', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/projects/e2e-project/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Release decision')).toBeVisible({ timeout: 15_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${viewport.name} horizontal overflow`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(os.tmpdir(), `qa-desk-${viewport.name}.png`), fullPage: false });
  }

  expect(consoleErrors).toEqual([]);
});
