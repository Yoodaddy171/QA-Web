import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = process.env.QA_PHASE7_ROOT || '';
if (!path.basename(root).startsWith('qadesk-phase7-')) throw new Error('Owned synthetic fixture required');
const f = JSON.parse(fs.readFileSync(path.join(root, 'fixture.json'), 'utf8'));
if (!f.actors.multi || !f.databaseUrl.startsWith(`file:${root.replaceAll('\\', '/')}/`)) throw new Error('Use fresh --ux fixture');
const db = new PrismaClient({ datasourceUrl: f.databaseUrl });
const route = (tab: string, project = f.project.id) => `/projects/${project}/${tab}`;
async function identity(context: BrowserContext, alias: string) {
  await context.addCookies([{ name: 'qa_session', value: f.actors[alias].token, url: f.origin }]);
}
async function cases(page: Page, writable = true) {
  await page.goto(route('test-cases'));
  await expect(page.locator('tbody tr').first()).toContainText('P7-');
  if (writable) await expect(page.getByRole('button', { name: /Add Test Case/ })).toBeVisible();
  else await expect(page.getByText(/Mode baca saja/)).toBeVisible();
}
async function inventoryStatus(page: Page, value: string) {
  const trigger = page.getByRole('combobox', { name: 'Status for P7-001', exact: true });
  await trigger.click();
  const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/testcases' && r.request().method() === 'PUT');
  await page.getByRole('option', { name: value, exact: true }).click();
  expect((await saved).ok()).toBeTruthy();
  await expect(trigger).toContainText(value);
}
async function bugStatus(page: Page, value: string) {
  await page.getByLabel('Status for bug P7-001', { exact: true }).click();
  const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/bugfix' && r.request().method() === 'PUT');
  await page.getByRole('option', { name: value, exact: true }).click();
  expect((await saved).ok()).toBeTruthy();
}
async function reportDraft(page: Page, id: string) {
  await page.goto(route('reports'));
  await page.getByRole('button', { name: 'Buat Report', exact: true }).click();
  for (const name of ['Template', 'Document ID', 'Source Test Cycle', 'Version', 'Document Status', 'Author', 'Approved By', 'Tanggal penerbitan', 'Periode report', 'Scope / Introduction']) await expect(page.getByLabel(name, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Source Test Cycle', { exact: true })).toHaveAttribute('aria-required', 'true');
  await page.getByLabel('Document ID', { exact: true }).fill(id);
  await page.getByLabel('Author', { exact: true }).fill('Synthetic QA');
  await page.getByLabel('Approved By', { exact: true }).fill('Synthetic Lead');
  await page.getByLabel('Source Test Cycle', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('option', { name: /Phase7 Cycle/ }).click();
  const period = page.getByLabel('Periode report', { exact: true });
  await expect(period).toHaveAccessibleDescription(/^Wajib diisi\./);
  await expect(page.getByLabel('Tanggal penerbitan', { exact: true })).toHaveAccessibleDescription(/^Wajib diisi\./);
  await period.focus(); await page.keyboard.press('Enter');
  const days = page.getByRole('gridcell').getByRole('button');
  await days.filter({ hasText: /^10$/ }).first().click();
  await days.filter({ hasText: /^12$/ }).first().click();
  await page.keyboard.press('Escape'); await expect(period).toBeFocused();
  await page.getByRole('button', { name: 'Approval, Revision Log, References' }).click();
  for (const name of ['Document Information', 'Revision Log', 'References']) await expect(page.getByLabel(name, { exact: true })).toBeVisible();
  const saving = page.waitForResponse(r => new URL(r.url()).pathname === '/api/reports' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  expect((await saving).ok()).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Edit Draft', exact: true })).toBeVisible();
  return db.report.findFirstOrThrow({ where: { projectId: f.project.id, documentId: id } });
}

test.beforeEach(async ({ context, page }, info) => {
  await identity(context, 'lead');
  await context.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//, r => r.abort());
  await context.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001\//, ws => ws.close());
  const errors: string[] = [], network: object[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (new URL(r.url()).pathname.startsWith('/api/')) network.push({ method: r.request().method(), path: new URL(r.url()).pathname, status: r.status() }); });
  info.annotations.push({ type: 'fixture', description: 'Synthetic A; explicit role changes use separate test contexts; user relay blocked' });
  (page as any).__p71 = { errors, network };
});
test.afterEach(async ({ page }, info) => {
  await info.attach('network-runtime', { body: JSON.stringify((page as any).__p71, null, 2), contentType: 'application/json' });
  expect((page as any).__p71.errors).toEqual([]);
});
test.afterAll(async () => { await db.$disconnect(); });

test('P71-A1 labels, required semantics, keyboard, retained input, QA create/edit', async ({ page, context }) => {
  await identity(context, 'qa'); await cases(page);
  const opener = page.getByRole('button', { name: /Add Test Case/ });
  await opener.click(); const dialog = page.getByRole('dialog');
  for (const name of ['Test Case ID', 'Page / Menu', 'Sub Menu', 'Tipe Test', 'Prioritas', 'Module', 'Test Action', 'Test Steps', 'Expected Result', 'Actual Result', 'Status', 'Remarks / Catatan', 'Tags']) await expect(dialog.getByLabel(new RegExp(`^${name.replace('/', '\\/')}( \\*)?$`))).toBeVisible();
  const id = dialog.getByLabel(/^Test Case ID/), action = dialog.getByLabel(/^Test Action/);
  await expect(action).toHaveAttribute('aria-required', 'true');
  await id.focus(); await page.keyboard.press('Tab'); await expect(dialog.getByLabel(/^Page \/ Menu/)).toBeFocused();
  await page.keyboard.press('Tab'); await expect(dialog.getByLabel('Sub Menu', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); const type = dialog.getByLabel(/^Tipe Test/); await expect(type).toBeFocused();
  await page.keyboard.press('Enter'); await page.getByRole('option', { name: 'Negative', exact: true }).click(); await expect(type).toBeFocused();
  await id.fill('P71-CASE'); await action.fill('Retained accessible input');
  const before = await db.testCase.count();
  await dialog.getByRole('button', { name: 'Buat Test Case', exact: true }).click();
  await expect(page.getByText('Mohon isi field yang wajib (*)', { exact: true })).toBeVisible();
  await expect(action).toHaveValue('Retained accessible input'); expect(await db.testCase.count()).toBe(before);
  await dialog.getByLabel(/^Page \/ Menu/).fill('Accessible page');
  await dialog.getByLabel(/^Test Steps/).fill('Open\nCheck'); await dialog.getByLabel(/^Expected Result/).fill('Saved');
  await dialog.getByRole('button', { name: 'Buat Test Case', exact: true }).click(); await expect(dialog).toBeHidden();
  const saved = await db.testCase.findFirstOrThrow({ where: { projectId: f.project.id, testCaseId: 'P71-CASE' } });
  expect(saved.testAction).toBe('Retained accessible input');
  await page.locator('[data-search-input]').fill('P71-CASE');
  await page.getByRole('button', { name: 'Actions for P71-CASE' }).click(); await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await dialog.getByLabel(/^Test Action/).fill('Edited without tags'); await dialog.getByRole('button', { name: 'Simpan Perubahan' }).click();
  await expect(dialog).toBeHidden(); expect((await db.testCase.findUniqueOrThrow({ where: { id: saved.id } })).testAction).toBe('Edited without tags');
  await opener.click(); await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(opener).toBeFocused();
  await page.screenshot({ path: path.join(root, 'p71-cases.png'), timeout: 5000 });
});

test('P71-A2 report names, calendar keyboard, QA draft and lead-only finalization', async ({ page, context }) => {
  await identity(context, 'qa');
  const report = await reportDraft(page, 'P71-QA-DRAFT');
  await expect(page.getByRole('button', { name: 'Edit Draft', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalize', exact: true })).toHaveCount(0);
  const denied = await page.request.post(`/api/reports/${report.id}/finalize`, { data: {} });
  expect(denied.status()).toBe(403); expect((await db.report.findUniqueOrThrow({ where: { id: report.id } })).status).toBe('DRAFT');
  await page.getByRole('button', { name: 'Edit Draft', exact: true }).click();
  await expect(page.getByLabel('Document ID', { exact: true })).toHaveValue('P71-QA-DRAFT');
  await page.getByLabel('Version', { exact: true }).fill(''); await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByLabel('Version', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Document ID', { exact: true })).toHaveValue('P71-QA-DRAFT');
});

test('P71-B1 Viewer reads details and screens without mutation affordances; server still denies', async ({ page, context }) => {
  await identity(context, 'viewer'); await cases(page, false);
  await expect(page.getByRole('button', { name: /Add Test Case|Import Excel|Generate AI/ })).toHaveCount(0);
  await page.keyboard.press('n'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Status for P7-001', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Actions for P7-001' }).click();
  await expect(page.getByRole('menuitem', { name: /^(Edit|Duplikasi|Hapus)$/ })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Lihat Detail' }).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Test Case', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Comments', exact: true }).click(); await expect(page.getByRole('button', { name: 'Tambah komentar' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  const before = await db.testCase.findUniqueOrThrow({ where: { id: f.cases[0].id } }); const history = await db.activityHistory.count();
  expect((await page.request.put('/api/testcases', { data: { id: before.id, status: 'FAILED' } })).status()).toBe(403);
  expect(await db.testCase.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before); expect(await db.activityHistory.count()).toBe(history);
  await page.goto(route('test-runs')); await page.getByRole('button', { name: /Phase7 Cycle/ }).first().click();
  await expect(page.getByRole('button', { name: /^Pass P$/ })).toBeDisabled();
  await expect(page.locator('input[type=file]')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cycle baru', exact: true })).toHaveCount(0);
  const executions = await db.testExecution.count(); await page.keyboard.press('f');
  await page.getByRole('button', { name: /Next Case/ }).click(); expect(await db.testExecution.count()).toBe(executions);
  expect((await page.request.post(`/api/test-runs/${f.run.id}/executions`, { data: { projectId: f.project.id, testCaseId: f.cases[0].id, status: 'FAILED' } })).status()).toBe(403);
  for (const tab of ['bugs', 'traceability', 'reports', 'settings']) { await page.goto(route(tab)); await expect(page.locator('main')).toBeVisible(); }
  await page.getByRole('tab', { name: 'Team', exact: true }).click(); await expect(page.getByRole('button', { name: 'Tambah member', exact: true })).toHaveCount(0);
  await page.goto(route('reports')); await expect(page.getByText('Buat dan tinjau Test Status Report maupun dokumen Test Planning.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buat Report', exact: true })).toHaveCount(0);
  await page.screenshot({ path: path.join(root, 'p71-viewer.png'), timeout: 5000 });
});

test('P71-B2 ADMIN in A switches to VIEWER in B without borrowing privilege', async ({ page, context }) => {
  await identity(context, 'multi'); await cases(page);
  const session = await (await page.request.get('/api/auth/status')).json();
  expect(session.user.memberships.map((m: any) => [m.workspace.id, m.role])).toEqual(expect.arrayContaining([[f.project.workspaceId, 'ADMIN'], [f.foreign.workspaceId, 'VIEWER']]));
  await page.getByRole('combobox').filter({ hasText: 'Phase7 Acceptance' }).click(); await page.getByRole('option', { name: 'Phase7 Private', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(f.foreign.id)); await expect(page.getByText(/Mode baca saja/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Add Test Case|Import Excel/ })).toHaveCount(0);
  const before = await db.testCase.findUniqueOrThrow({ where: { id: f.foreignCase.id } });
  expect((await page.request.put('/api/testcases', { data: { id: before.id, status: 'FAILED' } })).status()).toBe(403);
  expect(await db.testCase.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before);
  await page.goto(route('settings', f.foreign.id)); await page.getByRole('tab', { name: 'Team', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tambah member', exact: true })).toHaveCount(0);
  await page.goto(route('test-cases')); await expect(page.getByRole('button', { name: /Add Test Case/ })).toBeVisible();
});

test('P71-B3 ADMIN and OWNER retain QA actions and owner restrictions', async ({ browser }) => {
  for (const alias of ['admin', 'owner']) {
    const context = await browser.newContext({ baseURL: f.origin, viewport: { width: 1440, height: 900 } });
    await context.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//, r => r.abort());
    await context.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001\//, ws => ws.close());
    await identity(context, alias); const page = await context.newPage(); await cases(page);
    await page.getByRole('button', { name: 'Actions for P7-001' }).click(); await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible(); await page.keyboard.press('Escape');
    await page.goto(route('settings')); await page.getByRole('tab', { name: 'Team', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Tambah member', exact: true })).toBeVisible();
    const ownerRow = page.locator('div').filter({ has: page.getByText('Phase7 owner', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Hapus Phase7 owner', exact: true }) }).last();
    if (alias === 'admin') await expect(ownerRow.getByRole('combobox')).toBeDisabled(); else await expect(ownerRow.getByRole('combobox')).toBeEnabled();
    await context.close();
  }
});

test('P71-C-D one coherent execution → evidence → Bug → inventory retest → final Report smoke', async ({ page, context }) => {
  await cases(page); await expect(page.getByText(/Status inventory: retest Bug/)).toBeVisible();
  await page.goto(route('test-runs')); await page.getByRole('button', { name: /Phase7 Cycle/ }).first().click();
  await expect(page.getByText(/Hasil execution hanya untuk cycle ini/)).toBeVisible();
  await page.getByRole('button', { name: /^Fail F$/ }).click();
  await expect.poll(() => db.testExecution.count({ where: { testCaseId: f.cases[0].id, status: 'FAILED' } })).toBe(1);
  expect((await db.testCase.findUniqueOrThrow({ where: { id: f.cases[0].id } })).status).toBe('NOT DONE');
  await expect(page.getByText(/Create Bug menghubungkan execution gagal/)).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'p71-evidence.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
  await expect(page.getByRole('link', { name: 'p71-evidence.png' })).toBeVisible();
  await page.getByRole('button', { name: 'Create Bug', exact: true }).click();
  await expect.poll(() => db.bugFix.count({ where: { sourceTestCaseId: f.cases[0].id } })).toBe(1);
  const bug = await db.bugFix.findFirstOrThrow({ where: { sourceTestCaseId: f.cases[0].id } });
  expect(bug.sourceExecutionId).toBeTruthy();
  expect((await db.testCase.findUniqueOrThrow({ where: { id: f.cases[0].id } })).status).toBe('FAILED');
  await identity(context, 'qa');
  expect((await (await page.request.get('/api/auth/status')).json()).user.id).toBe(f.actors.qa.id);
  await page.goto(route('bugs')); await expect(page.getByText(/READY TO RETEST: uji ulang testcase inventory/)).toBeVisible();
  await bugStatus(page, 'SEDANG DI FIX'); await bugStatus(page, 'READY TO RETEST');
  expect((await db.testCase.findUniqueOrThrow({ where: { id: f.cases[0].id } })).status).toBe('READY TO RETEST');
  await page.goto(route('test-runs')); await page.getByRole('button', { name: /Phase7 Cycle/ }).first().click();
  await page.getByRole('button', { name: /^Pass P$/ }).click();
  await expect.poll(() => db.testExecution.count({ where: { testCaseId: f.cases[0].id, status: 'PASSED' } })).toBe(1);
  expect((await db.bugFix.findUniqueOrThrow({ where: { id: bug.id } })).status).toBe('READY TO RETEST');
  await cases(page); await inventoryStatus(page, 'DONE');
  await expect.poll(async () => (await db.bugFix.findUniqueOrThrow({ where: { id: bug.id } })).status).toBe('VERIFIED & FIXED');
  await page.goto(route('dashboard')); await expect(page.getByText(/Pass execution tidak otomatis/)).toBeVisible();
  await identity(context, 'lead');
  expect((await (await page.request.get('/api/auth/status')).json()).user.id).toBe(f.actors.lead.id);
  const report = await reportDraft(page, 'P71-SMOKE'); expect(report.testRunId).toBe(f.run.id);
  await expect(page.getByText(/Hasil cycle berasal dari execution/)).toBeVisible();
  await page.getByRole('button', { name: 'Finalize', exact: true }).click();
  await expect.poll(async () => (await db.report.findUniqueOrThrow({ where: { id: report.id } })).status).toBe('FINAL');
  const persisted = await db.testExecution.findUniqueOrThrow({ where: { id: bug.sourceExecutionId! }, include: { evidence: true } });
  expect(persisted.evidence).toHaveLength(1); expect(persisted.tester).toBe('Phase7 lead');
  await page.screenshot({ path: path.join(root, 'p71-report-final.png'), timeout: 5000 });
});

test('P71-B4 OWNER can still create the first project without granting unscoped QA permissions', async ({ page, context }) => {
  await identity(context, 'emptyOwner');
  const membership = await db.workspaceMembership.findFirstOrThrow({ where: { userId: f.actors.emptyOwner.id } });
  expect(await db.project.count({ where: { workspaceId: membership.workspaceId } })).toBe(0);
  await page.goto('/'); await page.getByRole('button', { name: /^Settings/ }).first().click();
  await page.getByRole('tab', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Project Baru', exact: true }).click();
  await page.getByPlaceholder('contoh: Servios CMS').fill('P71 First Project');
  await page.getByRole('button', { name: 'Buat Projec', exact: true }).click();
  await expect.poll(() => db.project.count({ where: { workspaceId: membership.workspaceId, name: 'P71 First Project' } })).toBe(1);
});

test('P71-A3 complete form field Tab sequences and instance-unique associations', async ({ page, context }) => {
  await identity(context, 'qa'); await cases(page);
  const count = await db.testCase.count();
  await page.getByRole('button', { name: /Add Test Case/ }).click();
  const dialog = page.getByRole('dialog');
  const names = [/^Test Case ID/, /^Page \/ Menu/, /^Sub Menu$/, /^Tipe Test/, /^Prioritas$/, /^Module$/, /^Test Action/, /^Test Steps/, /^Expected Result/, /^Actual Result$/, /^Status$/, /^Remarks \/ Catatan$/, /^Tags$/];
  const ids: string[] = [];
  await dialog.getByLabel(names[0]).focus();
  for (let i = 0; i < names.length; i++) {
    const field = dialog.getByLabel(names[i]);
    await expect(field).toBeFocused();
    ids.push((await field.getAttribute('id'))!);
    if (i < names.length - 1) await page.keyboard.press('Tab');
  }
  expect(new Set(ids).size).toBe(names.length);
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
  expect(await db.testCase.count()).toBe(count);
  await page.goto(route('reports')); await page.getByRole('button', { name: 'Buat Report', exact: true }).click();
  const reportNames = ['Template', 'Document ID', 'Source Test Cycle', 'Version', 'Document Status', 'Author', 'Approved By', 'Tanggal penerbitan', 'Periode report'];
  await page.getByLabel(reportNames[0], { exact: true }).focus();
  for (let i = 0; i < reportNames.length; i++) {
    const field = page.getByLabel(reportNames[i], { exact: true });
    await expect(field).toBeFocused();
    expect(ids).not.toContain(await field.getAttribute('id'));
    if (i < reportNames.length - 1) await page.keyboard.press('Tab');
  }
  await page.screenshot({ path: path.join(root, 'p71-report-form-keyboard.png'), timeout: 5000 });
});
