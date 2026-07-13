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

  expect(consoleErrors).toEqual([]);
});
