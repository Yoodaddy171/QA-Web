import { expect, test } from '@playwright/test';

test('loads the QA workspace and exposes primary navigation', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');

  await expect(page).toHaveTitle(/QADesk/i);
  await expect(page.getByText('QADesk', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dashboard/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cases/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Test Cycles/i })).toBeVisible();
  await page.getByRole('button', { name: /Test Cycles/i }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/test-runs$/);
  await expect(page.getByRole('heading', { name: 'Test Cycles' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Traceability/i })).toBeVisible();
  await page.getByRole('button', { name: /Traceability/i }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/traceability$/);
  await expect(page.getByRole('heading', { name: 'Traceability' })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
