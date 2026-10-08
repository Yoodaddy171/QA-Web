import { test, expect } from '../devlog-fixture';

/**
 * Ganti UUID di bawah dengan Internal Database ID dari detail Test Case QA Desk.
 * Jangan gunakan display ID seperti E-124.
 */
test.use({
  qaTestCaseId: 'REPLACE-WITH-QA-DESK-TEST-CASE-UUID',
});

test('example - login flow', async ({ page, qaLog }) => {
  const targetUrl = process.env.QA_BASE_URL || 'https://example.com';

  await qaLog(`Open ${targetUrl}`);
  await page.goto(targetUrl);

  await qaLog('Verify page is loaded');
  await expect(page).toHaveTitle(/.+/);
});
