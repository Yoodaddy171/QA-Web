import { test, expect } from './fixtures';
import type { APIRequestContext } from '@playwright/test';

async function createProject(request: APIRequestContext, count: number) {
  const response = await request.post('/api/projects', { data: { name: `Status regression ${Date.now()}` } });
  expect(response.ok()).toBeTruthy();
  const project = await response.json();
  for (let n = 1; n <= count; n++) {
    const created = await request.post('/api/testcases', { data: {
      projectId: project.id, testCaseId: `KEY-${String(n).padStart(3, '0')}`, page: 'Keyboard',
      testType: 'Positive', testAction: 'Check selector focus', steps: 'Open selector',
      expectedResult: 'Status persists', status: 'TBA', priority: 'High',
    } });
    expect(created.ok()).toBeTruthy();
  }
  return project;
}

test('dormant status triggers transfer focus and expose a real popup for every activation key', async ({ page, request }) => {
  const project = await createProject(request, 5);
  try {
    await page.goto(`/projects/${project.id}/test-cases`);
    let writes = 0;
    page.on('request', request => { if (request.method() === 'PUT' && new URL(request.url()).pathname === '/api/testcases') writes++; });
    for (const [index, key] of ['Mouse', 'Enter', 'Space', 'ArrowDown', 'ArrowUp'].entries()) {
      const trigger = page.getByRole('combobox', { name: `Status for KEY-${String(index + 1).padStart(3, '0')}`, includeHidden: true });
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
      await trigger.focus();
      if (key === 'Mouse') await trigger.click(); else await page.keyboard.press(key);
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('listbox')).toBeVisible();
      const popupId = await trigger.getAttribute('aria-controls');
      expect(popupId).toBeTruthy();
      await expect(page.locator(`[id="${popupId}"]`)).toHaveAttribute('role', 'listbox');
      await expect(page.getByRole('dialog')).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click();
      await page.mouse.click(700, 110);
      await expect(page.getByRole('listbox')).toBeHidden();
      await trigger.focus(); await page.keyboard.press('Tab');
      await expect(trigger).not.toBeFocused();
    }
    expect(writes).toBe(0);
  } finally { expect((await request.delete(`/api/projects?id=${project.id}`)).ok()).toBeTruthy(); }
});

test('all seven statuses persist with one mutation per choice and restored trigger focus', async ({ page, request }) => {
  const project = await createProject(request, 1);
  try {
    await page.goto(`/projects/${project.id}/test-cases`);
    const trigger = page.getByRole('combobox', { name: 'Status for KEY-001' });
    let writes = 0;
    page.on('request', request => { if (request.method() === 'PUT' && new URL(request.url()).pathname === '/api/testcases') writes++; });
    // Visit FAILED before DONE: existing retest rules can resolve a later
    // FAILED -> READY TO RETEST request with As Expected back to DONE.
    for (const status of ['FAILED', 'NOT DONE', 'IN PROGRESS', 'BLOCKED', 'READY TO RETEST', 'DONE', 'TBA']) {
      await trigger.click();
      const saved = page.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname === '/api/testcases');
      await page.getByRole('option', { name: status, exact: true }).click();
      expect((await saved).ok()).toBeTruthy();
      await expect(trigger).toContainText(status);
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      const readBack = await request.get(`/api/testcases?projectId=${project.id}`);
      expect(readBack.ok()).toBeTruthy();
      expect((await readBack.json()).testCases[0].status).toBe(status);
      await expect(page.getByRole('dialog')).toBeHidden();
    }
    expect(writes).toBe(7);
    await page.reload(); await expect(trigger).toContainText('TBA');
  } finally { expect((await request.delete(`/api/projects?id=${project.id}`)).ok()).toBeTruthy(); }
});

test('status editing remains correct after sorting, search filtering and pagination', async ({ page, request }) => {
  const project = await createProject(request, 12);
  try {
    await page.goto(`/projects/${project.id}/test-cases`);
    await page.getByRole('columnheader', { name: 'ID', exact: true }).click();
    await expect(page.locator('tbody tr').first()).toContainText('KEY-012');
    const first = page.getByRole('combobox', { name: 'Status for KEY-012' });
    await first.click(); await page.getByRole('option', { name: 'FAILED', exact: true }).click();
    await expect(first).toContainText('FAILED');
    await page.getByRole('button', { name: 'Halaman berikutnya', exact: true }).click();
    const last = page.getByRole('combobox', { name: 'Status for KEY-001' });
    await last.click(); await page.getByRole('option', { name: 'BLOCKED', exact: true }).click();
    await expect(last).toContainText('BLOCKED');
    await page.locator('[data-search-input]').fill('KEY-001');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await last.click(); await page.getByRole('option', { name: 'READY TO RETEST', exact: true }).click();
    await expect(last).toContainText('READY TO RETEST');
    await page.locator('[data-search-input]').fill('');
    await expect(page.locator('tbody tr')).toHaveCount(10);
    await page.getByRole('columnheader', { name: 'ID', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Status for KEY-001' })).toContainText('READY TO RETEST');
    const readBack = await request.get(`/api/testcases?projectId=${project.id}&limit=100`);
    const rows = (await readBack.json()).testCases;
    expect(rows.find((row: { testCaseId: string }) => row.testCaseId === 'KEY-012').status).toBe('FAILED');
    expect(rows.find((row: { testCaseId: string }) => row.testCaseId === 'KEY-001').status).toBe('READY TO RETEST');
  } finally { expect((await request.delete(`/api/projects?id=${project.id}`)).ok()).toBeTruthy(); }
});

test('changing a status reapplies the active status filter instead of leaving a stale row', async ({ page, request }) => {
  const project = await createProject(request, 3);
  try {
    await page.goto(`/projects/${project.id}/test-cases`);
    await page.getByRole('button', { name: /^Filter/ }).first().click();
    await page.getByRole('combobox').filter({ hasText: 'All Status' }).click();
    await page.getByRole('option', { name: 'TBA (To Be Announced)', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('tbody tr')).toHaveCount(3);
    const trigger = page.getByRole('combobox', { name: 'Status for KEY-001' });
    await trigger.click();
    const saved = page.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname === '/api/testcases');
    await page.getByRole('option', { name: 'FAILED', exact: true }).click();
    expect((await saved).ok()).toBeTruthy();
    const readBack = await request.get(`/api/testcases?projectId=${project.id}`);
    expect((await readBack.json()).testCases.find((row: { testCaseId: string }) => row.testCaseId === 'KEY-001').status).toBe('FAILED');
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(trigger).toBeHidden();
  } finally { expect((await request.delete(`/api/projects?id=${project.id}`)).ok()).toBeTruthy(); }
});

test('a server-normalized retest status is displayed rather than the requested value', async ({ page, request }) => {
  const project = await createProject(request, 1);
  try {
    await page.goto(`/projects/${project.id}/test-cases`);
    const trigger = page.getByRole('combobox', { name: 'Status for KEY-001' });
    for (const [requested, expected] of [['DONE', 'DONE'], ['FAILED', 'FAILED'], ['READY TO RETEST', 'DONE']]) {
      await trigger.click();
      const saved = page.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname === '/api/testcases');
      await page.getByRole('option', { name: requested, exact: true }).click();
      expect((await (await saved).json()).status).toBe(expected);
      await expect(trigger).toContainText(expected);
    }
    await page.reload(); await expect(trigger).toContainText('DONE');
  } finally { expect((await request.delete(`/api/projects?id=${project.id}`)).ok()).toBeTruthy(); }
});

test('an older read cannot overwrite a successful status mutation', async ({ page, request }) => {
  const project = await createProject(request, 1);
  let release: (() => void) | undefined;
  try {
    await page.goto(`/projects/${project.id}/test-cases`);
    const trigger = page.getByRole('combobox', { name: 'Status for KEY-001' });
    await expect(trigger).toContainText('TBA');
    let intercepted: (() => void) | undefined;
    const captured = new Promise<void>(resolve => { intercepted = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    let first = true;
    await page.route('**/api/testcases?**', async route => {
      if (!first) return route.continue();
      first = false;
      const oldResponse = await route.fetch();
      intercepted?.(); await held;
      await route.fulfill({ response: oldResponse }).catch(() => {});
    });
    await page.getByRole('columnheader', { name: 'ID', exact: true }).click();
    await captured;
    // The retained row stays usable while its new query is pending.
    await trigger.click();
    const saved = page.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname === '/api/testcases');
    await page.getByRole('option', { name: 'BLOCKED', exact: true }).click();
    expect((await saved).ok()).toBeTruthy();
    release?.();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(trigger).toContainText('BLOCKED');
    await page.reload(); await expect(trigger).toContainText('BLOCKED');
  } finally { release?.(); expect((await request.delete(`/api/projects?id=${project.id}`)).ok()).toBeTruthy(); }
});

test('responsive columns remount on resize and respect saved user visibility', async ({ page, request }) => {
  const project = await createProject(request, 1);
  try {
    await page.setViewportSize({ width: 1536, height: 900 });
    await page.goto(`/projects/${project.id}/test-cases`);
    await expect(page.locator('thead th')).toHaveCount(14);
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(page.locator('thead th')).toHaveCount(6);
    await expect(page.getByRole('combobox', { name: 'Status for KEY-001' })).toBeAttached();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('thead th')).toHaveCount(11);
    await page.getByRole('button', { name: 'Columns', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Status', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('thead th')).toHaveCount(10);
    await page.reload();
    await expect(page.locator('thead th')).toHaveCount(10);
    await expect(page.getByRole('combobox', { name: 'Status for KEY-001' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Columns', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Status', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox', { name: 'Status for KEY-001' })).toContainText('TBA');
  } finally { expect((await request.delete(`/api/projects?id=${project.id}`)).ok()).toBeTruthy(); }
});

test('a pending status save refreshes the latest filter, not its earlier query', async ({ page, request }) => {
  const project = await createProject(request, 2);
  let release: (() => void) | undefined;
  try {
    await page.goto(`/projects/${project.id}/test-cases`);
    let intercepted: (() => void) | undefined;
    const captured = new Promise<void>(resolve => { intercepted = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/testcases', async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      intercepted?.(); await held; await route.continue();
    });
    await page.getByRole('combobox', { name: 'Status for KEY-001' }).click();
    await page.getByRole('option', { name: 'FAILED', exact: true }).click();
    await captured;
    await page.getByRole('button', { name: /^Filter/ }).first().click();
    await page.getByRole('combobox').filter({ hasText: 'All Status' }).click();
    await page.getByRole('option', { name: 'TBA (To Be Announced)', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    const saved = page.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname === '/api/testcases');
    release?.(); expect((await saved).ok()).toBeTruthy();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr').first()).toContainText('KEY-002');
  } finally { release?.(); expect((await request.delete(`/api/projects?id=${project.id}`)).ok()).toBeTruthy(); }
});

test('system theme follows the OS without navigation and reduced-motion inspector still renders', async ({ page, request }) => {
  const project = await createProject(request, 1);
  try {
  await page.goto(`/projects/${project.id}/test-cases`);
  const location = page.url();
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await page.getByRole('menuitem', { name: 'System', exact: true }).click();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await expect.poll(() => page.locator('html').evaluate(element => element.classList.contains('dark'))).toBe(colorScheme === 'dark');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme-changing', '');
    expect(page.url()).toBe(location);
    expect(await page.evaluate(() => localStorage.getItem('web-qa:theme'))).toBe('system');
  }
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('tbody tr').first().locator('td').nth(2).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Identification', { exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Memuat detail testcase' })).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  } finally { expect((await request.delete(`/api/projects?id=${project.id}`)).ok()).toBeTruthy(); }
});
