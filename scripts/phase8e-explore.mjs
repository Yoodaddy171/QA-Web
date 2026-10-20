import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { chromium, expect } = require('@playwright/test');
const root = path.join(os.tmpdir(), 'qadesk-phase8e-20261019'), f = JSON.parse(await fs.readFile(path.join(root, 'fixture.json'), 'utf8'));
const out = path.join(root, 'before'); await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await context.addCookies([{ name: 'qa_session', value: f.actors.owner.token, url: f.origin }]);
await context.addInitScript(() => localStorage.setItem('web-qa:theme', 'dark'));
await context.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//, r => r.abort());
await context.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001/, ws => ws.close());
const page = await context.newPage(), observations = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(`${f.origin}/projects/${f.project.id}/traceability`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByRole('button', { name: 'Graph View', exact: true }).click();
  await expect(page.getByRole('button', { name: /AUTH-001 —/ })).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: path.join(out, 'initial-1440-dark.png') });
  await page.getByRole('button', { name: /AUTH-001 —/ }).click();
  const graph = page.getByRole('region', { name: /Canvas graph/ });
  await expect(graph.getByRole('button', { name: /Testcase: AUTH-001/ })).toBeVisible();
  for (const [width, height, theme] of [[1440, 900, 'dark'], [1440, 900, 'light'], [1366, 768, 'dark'], [390, 844, 'dark']]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(t => { document.documentElement.classList.toggle('dark', t === 'dark'); document.documentElement.classList.toggle('light', t === 'light'); }, theme);
    await page.getByRole('button', { name: 'Fit', exact: true }).click();
    await page.screenshot({ path: path.join(out, `graph-${width}-${theme}.png`), fullPage: true });
    observations.push({ width, theme, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), zoom: await page.locator('span').filter({ hasText: /^\d+%$/ }).allTextContents() });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await graph.getByRole('button', { name: 'Bug: AUTH-001', exact: true }).click();
  const beforeReset = await graph.getByRole('button', { pressed: true }).getAttribute('aria-label');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  observations.push({ defect: 'GRAPH-001', beforeReset, afterReset: await graph.getByRole('button', { pressed: true }).getAttribute('aria-label') });
  await page.getByRole('button', { name: 'Existing Traceability View', exact: true }).click();
  await page.getByRole('button', { name: 'Graph View', exact: true }).click();
  observations.push({ observation: 'View switch discards graph focus', canvas: await graph.innerText() });
  await fs.writeFile(path.join(root, 'before-observations.json'), JSON.stringify({ observations, errors, browser: browser.version() }, null, 2));
} finally { await browser.close(); }
