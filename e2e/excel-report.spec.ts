import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

const root = path.join(os.tmpdir(), 'qadesk-phase8e-20261019');
const f = JSON.parse(readFileSync(path.join(root, 'fixture.json'), 'utf8'));
if (!f.databaseUrl.startsWith(`file:${root.replaceAll('\\', '/')}/`) || f.origin !== 'http://127.0.0.1:3127') throw Error('Owned synthetic fixture required');
const db = new PrismaClient({ datasourceUrl: f.databaseUrl });
const token = crypto.randomBytes(32).toString('base64url');
let sessionId: string;
test.beforeAll(async () => {
  sessionId = (await db.session.create({ data: { userId: f.actors.owner.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } })).id;
});
test.afterAll(async () => { if (sessionId) await db.session.deleteMany({ where: { id: sessionId } }); await db.$disconnect(); });

test('QA Report download, source reconciliation, legacy contracts and import guard', async ({ page, context }) => {
  await context.addCookies([{ name: 'qa_session', value: token, url: f.origin }]);
  await context.addInitScript(() => localStorage.setItem('web-qa:theme', 'light'));
  await context.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//, r => r.abort());
  await context.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001/, ws => ws.close());
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const source = await db.testCase.findMany({ where: { projectId: f.project.id }, orderBy: { testCaseId: 'asc' } });
  const before = JSON.stringify(source);
  await page.goto(`/projects/${f.project.id}/test-cases`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const item = page.getByRole('menuitem', { name: 'QA Report XLSX (Summary + Cases)', exact: true });
  await expect(item).toBeVisible();
  await page.screenshot({ path: path.join(root, 'excel-export-menu-desktop.png') });
  const downloadPromise = page.waitForEvent('download'); await item.click(); const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^qadesk-qa-report-\d{4}-\d\d-\d\d\.xlsx$/);
  const output = path.join(root, 'qa-report-browser.xlsx'); await download.saveAs(output);
  const buffer = await fs.readFile(output);
  const report = XLSX.read(buffer, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(report.Sheets['Test Cases']);
  expect(rows.map(row => row.UUID)).toEqual(source.map(tc => tc.id));
  const totalCell = Object.entries(report.Sheets.Summary).find(([, cell]) => cell?.v === 'Total testcase')![0];
  expect(report.Sheets.Summary[`B${totalCell.slice(1)}`].v).toBe(source.length);
  for (const [i, tc] of source.entries()) {
    expect(rows[i].Status).toBe(tc.status); expect(rows[i].Progress).toBe(tc.progress / 100);
    expect(rows[i]['Test Type']).toBe(tc.testType); expect(rows[i].Priority).toBe(tc.priority);
  }
  const importResponse = await context.request.post(`/api/excel?projectId=${f.project.id}`, { headers: { Origin: f.origin }, multipart: {
    projectId: f.project.id, mode: 'preview', createModules: 'true', file: { name: 'report.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer },
  } });
  expect(importResponse.status()).toBe(400); expect((await importResponse.json()).error).toContain('Legacy XLSX');
  const selected = await context.request.get(`/api/excel?projectId=${f.project.id}&template=qa-report&ids=${source[0].id}`);
  expect(selected.ok()).toBe(true);
  const selectedBook = XLSX.read(await selected.body(), { type: 'buffer' });
  expect(XLSX.utils.sheet_to_json(selectedBook.Sheets['Test Cases'])).toHaveLength(1);
  expect(selectedBook.Sheets.Summary.B6.v).toContain('dipilih saja');
  for (const suffix of ['', '&multiSheet=true', '&format=csv']) {
    const legacy = await context.request.get(`/api/excel?projectId=${f.project.id}${suffix}`); expect(legacy.ok()).toBe(true);
    if (suffix.includes('csv')) {
      const csv = XLSX.read(await legacy.text(), { type: 'string' });
      expect((XLSX.utils.sheet_to_json<string[]>(csv.Sheets[csv.SheetNames[0]], { header: 1 })[0]).slice(0, 3)).toEqual(['ID', 'Page', 'Sub Menu']);
    } else { const book = new ExcelJS.Workbook(); await book.xlsx.load(new Uint8Array(await legacy.body()).buffer); expect(book.getWorksheet('Summary')).toBeUndefined(); }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Export', exact: true }).click(); await expect(item).toBeVisible();
  expect(await page.getByRole('menu').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })).toBe(true);
  await page.screenshot({ path: path.join(root, 'excel-export-menu-mobile.png') }); await page.keyboard.press('Escape');
  expect(JSON.stringify(await db.testCase.findMany({ where: { projectId: f.project.id }, orderBy: { testCaseId: 'asc' } }))).toBe(before);
  expect(errors).toEqual([]);
});
