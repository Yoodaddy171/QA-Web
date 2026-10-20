import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PrismaClient } from '@prisma/client';

const root = path.join(os.tmpdir(), 'qadesk-phase8e-20261019');
const f = JSON.parse(readFileSync(path.join(root, 'fixture.json'), 'utf8'));
if (!f.databaseUrl.startsWith(`file:${root.replaceAll('\\', '/')}/`) || f.origin !== 'http://127.0.0.1:3127') throw Error('Synthetic Phase8E fixture required');
const db = new PrismaClient({ datasourceUrl: f.databaseUrl });
const canvas = (p: Page) => p.getByRole('region', { name: /Canvas graph/ });
const detail = (p: Page) => p.getByRole('complementary', { name: 'Detail node terpilih' });
async function openGraph(p: Page) {
  await p.goto(`/projects/${f.project.id}/traceability`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.getByRole('button', { name: 'Graph View', exact: true }).click();
  await expect(p.getByLabel('Cari nama atau ID')).toBeVisible();
}
async function choose(p: Page, type = 'Testcase', text = 'AUTH-001') {
  const change = p.getByRole('button', { name: 'Ganti object', exact: true });
  if (await change.isVisible() && await change.isEnabled()) await change.click();
  const start = p.getByLabel('Mulai dari', { exact: true });
  if ((await start.innerText()).trim() !== type) { await start.click(); await p.getByRole('option', { name: type, exact: true }).click(); }
  await p.getByLabel('Cari nama atau ID').fill(text);
  await p.locator('[aria-label="Hasil pencarian fokus graph"]').getByRole('button', { name: new RegExp(`^${text}`) }).click();
  await expect(canvas(p).locator('[data-graph-node]')).not.toHaveCount(0);
}
async function filters(p: Page) { const s = p.locator('summary').filter({ hasText: /^Filter tampilan/ }); if (!(await s.evaluate(e => (e.parentElement as HTMLDetailsElement).open))) await s.click(); }
async function selectFilter(p: Page, label: string, value: string) { await p.getByRole('combobox', { name: label, exact: true }).click(); await p.getByRole('option', { name: value, exact: true }).click(); }
const graphURL = (type: string, id?: string, projectId = f.project.id, q = '') => `/api/traceability/graph?${new URLSearchParams({ projectId, seedType: type, ...(id ? { seedId: id } : {}), q })}`;

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: 'qa_session', value: f.actors.owner.token, url: f.origin }]);
  await context.addInitScript(() => localStorage.setItem('web-qa:theme', 'dark'));
  await context.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//, r => r.abort());
  await context.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001/, ws => ws.close());
});
test.afterAll(async () => { await db.$disconnect(); });

test('FUNC-8E-01: first use, search, graph identity and browser health', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await openGraph(page);
  await expect(page.getByText('Pilih Testcase atau Requirement untuk melihat hubungannya.', { exact: true })).toBeVisible();
  await choose(page);
  await expect(canvas(page).getByRole('button', { name: 'Testcase: AUTH-001, fokus graph', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(Number((await page.getByTestId('graph-zoom').innerText()).replace('%', ''))).toBeGreaterThanOrEqual(85);
  await expect(page).toHaveURL(new RegExp(`/projects/${f.project.id}/traceability`));
  expect(await page.title()).not.toBe('');
  await expect(page.locator('nextjs-portal [data-nextjs-dialog-overlay]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('GRAPH-001/003: selection, highlight, pan, zoom and Reset preserve selection', async ({ page }) => {
  await openGraph(page); await choose(page);
  await detail(page).getByRole('button', { name: /Sumber bug.*Bug: AUTH-001/ }).click();
  await expect(canvas(page).getByRole('button', { name: 'Bug: AUTH-001', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Zoom in graph', exact: true }).click();
  const zoom = await page.getByTestId('graph-zoom').innerText();
  await canvas(page).getByRole('button', { name: 'Bug: AUTH-001', exact: true }).click();
  await expect(page.getByTestId('graph-zoom')).toHaveText(zoom);
  await page.getByRole('button', { name: 'Reset tampilan', exact: true }).click();
  await expect(canvas(page).getByRole('button', { name: 'Bug: AUTH-001', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('graph-zoom')).toHaveText('100%');
  const layer = canvas(page).locator('div[style*="transform:"]').first();
  const old = await layer.getAttribute('style');
  await canvas(page).focus(); await page.keyboard.press('ArrowRight');
  await expect(layer).not.toHaveAttribute('style', old!);
  const box = await canvas(page).boundingBox();
  const beforeDrag = await layer.getAttribute('style');
  await page.mouse.move(box!.x + 20, box!.y + 30); await page.mouse.down(); await page.mouse.move(box!.x + 65, box!.y + 50); await page.mouse.up();
  await expect(layer).not.toHaveAttribute('style', beforeDrag!);
  await page.getByRole('button', { name: 'Paskan semua', exact: true }).click();
  await expect(page.getByText(/Mode ringkasan:/)).toBeVisible();
  await page.getByRole('button', { name: 'Zoom out graph', exact: true }).click();
  const opacities = await canvas(page).locator('[data-graph-node]').evaluateAll(nodes => nodes.map(n => Number((n as HTMLElement).style.opacity)));
  expect(opacities).toContain(1); expect(opacities).toContain(0.75);
});

test('FUNC-8E-03: entity/module/status/direct filters and empty recovery', async ({ page }) => {
  await openGraph(page); await choose(page); await filters(page);
  const all = await canvas(page).locator('[data-graph-node]').count();
  await page.getByRole('button', { name: 'Hubungan langsung', exact: true }).click();
  expect(await canvas(page).locator('[data-graph-node]').count()).toBeLessThan(all);
  await page.getByRole('button', { name: 'Semua yang dimuat', exact: true }).click();
  await selectFilter(page, 'Filter tipe entity graph', 'Bug');
  await expect(canvas(page).locator('[data-graph-node]')).toHaveCount(1);
  await selectFilter(page, 'Filter status graph', 'RETEST');
  await expect(canvas(page)).toContainText('Tidak ada object yang cocok dengan filter.');
  await page.getByRole('button', { name: 'Semua yang dimuat', exact: true }).click();
  await selectFilter(page, 'Filter module testcase graph', 'Identity & Access');
  await expect(page.locator('summary').filter({ hasText: 'Filter tampilan (1 aktif)' })).toBeVisible();
  await expect(canvas(page).locator(`[data-graph-node="TestCase:${f.cases[0].id}"]`)).toHaveCount(1);
});

test('FUNC-8E-04: correct testcase inspector and lane/graph focus preservation', async ({ page }) => {
  await openGraph(page); await choose(page);
  await page.getByRole('button', { name: 'Existing Traceability View', exact: true }).click();
  await expect(page.getByText('Requirements', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Graph View', exact: true }).click();
  await expect(canvas(page).locator(`[data-graph-node="TestCase:${f.cases[0].id}"]`)).toBeVisible();
  await detail(page).getByRole('button', { name: 'Buka testcase', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('AUTH-001');
  await expect(page.getByRole('dialog')).toContainText(f.cases[0].id);
});

test('FUNC-8E-05: requirement context and cycle navigation', async ({ page }) => {
  await openGraph(page); await choose(page, 'Requirement', 'REQ-PARTIAL');
  await detail(page).getByRole('button', { name: 'Lihat requirement', exact: true }).click();
  await expect(page.locator('.qa-selected-row')).toContainText('REQ-PARTIAL');
  await page.getByRole('button', { name: 'Graph View', exact: true }).click();
  await choose(page, 'Test Cycle', 'Sprint 12 Authentication');
  await detail(page).getByRole('button', { name: 'Buka cycle', exact: true }).click();
  await expect(page).toHaveURL(/test-runs$/);
  await expect(page.getByText('Sprint 12 Authentication', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: /Sprint 12 Authentication/, pressed: true })).toBeVisible();
  await page.goBack(); await expect(page).toHaveURL(/traceability$/);
  await page.goForward(); await expect(page).toHaveURL(/test-runs$/);
  await openGraph(page); await choose(page);
  await detail(page).getByRole('button', { name: /Dieksekusi sebagai.*Execution:/ }).first().click();
  await expect(detail(page)).toContainText('Graph');
  const executionKey = await canvas(page).getByRole('button', { pressed: true }).getAttribute('data-graph-node');
  const execution = await db.testExecution.findUniqueOrThrow({ where: { id: executionKey!.replace('Execution:', '') } });
  const run = await db.testRun.findUniqueOrThrow({ where: { id: execution.testRunId } });
  await detail(page).getByRole('button', { name: 'Buka cycle', exact: true }).click();
  await expect(page).toHaveURL(/test-runs$/);
  await expect(page.getByRole('button', { name: new RegExp(run.name), pressed: true })).toBeVisible();
});

test('FUNC-8E-06: Bug navigation is labeled honestly and ID is copyable', async ({ page, context }) => {
  await openGraph(page); await choose(page, 'Bug', 'AUTH-001');
  await expect(detail(page)).toContainText('Navigasi ini tidak langsung memilih satu Bug.');
  await detail(page).locator('summary').filter({ hasText: 'ID teknis' }).click();
  await expect(detail(page)).toContainText(f.bugs[0].id);
  await expect(detail(page).getByRole('button', { name: 'Salin ID', exact: true })).toBeVisible();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await detail(page).getByRole('button', { name: 'Salin ID', exact: true }).click();
  await expect(detail(page)).toContainText('ID disalin.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(f.bugs[0].id);
  await detail(page).getByRole('button', { name: 'Buka menu Bugs', exact: true }).click();
  await expect(page).toHaveURL(/bugs$/);
  await expect(page.locator('tbody')).toContainText('AUTH-001');
});

test('DATA-8E-07: API + rendered nodes/edges match persisted SQLite relations', async ({ page }) => {
  await openGraph(page); await choose(page);
  const response = await page.request.get(graphURL('TestCase', f.cases[0].id)); expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.truncated).toBe(false);
  expect(await canvas(page).locator('[data-graph-node]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-graph-node')).sort())).toEqual(data.nodes.map((n: any) => n.id).sort());
  expect(await canvas(page).locator('[data-graph-edge]').evaluateAll(edges => edges.map(e => e.getAttribute('data-graph-edge')).sort())).toEqual(data.edges.map((e: any) => e.id).sort());
  for (const n of data.nodes) {
    const model = ({ Requirement: db.requirement, TestCase: db.testCase, TestPlan: db.testPlan, TestRun: db.testRun, Execution: db.testExecution, BugFix: db.bugFix, Module: db.module } as any)[n.type];
    const row = await model.findUniqueOrThrow({ where: { id: n.entityId } });
    expect(n.id).toBe(`${n.type}:${row.id}`);
    if (n.type !== 'Execution') expect(row.projectId).toBe(f.project.id);
    for (const e of data.edges.filter((e: any) => e.source === n.id)) {
      const target = data.nodes.find((other: any) => other.id === e.target);
      if (n.type === 'Requirement' && target.type === 'TestCase') expect(await db.requirementTestCase.count({ where: { requirementId: row.id, testCaseId: target.entityId } })).toBe(1);
      else if (n.type === 'Requirement' && target.type === 'TestPlan') expect(await db.testPlanRequirement.count({ where: { requirementId: row.id, testPlanId: target.entityId } })).toBe(1);
      else if (n.type === 'Module') expect((await db.testCase.findUniqueOrThrow({ where: { id: target.entityId } })).moduleId).toBe(row.id);
      else if (n.type === 'TestPlan') expect((await db.testRun.findUniqueOrThrow({ where: { id: target.entityId } })).testPlanId).toBe(row.id);
      else if (n.type === 'TestCase' && target.type === 'TestRun') expect(await db.testRunCase.count({ where: { testCaseId: row.id, testRunId: target.entityId } })).toBe(1);
      else if (n.type === 'TestCase' && target.type === 'BugFix') expect((await db.bugFix.findUniqueOrThrow({ where: { id: target.entityId } })).sourceTestCaseId).toBe(row.id);
      else if (n.type === 'Execution' && target.type === 'BugFix') expect((await db.bugFix.findUniqueOrThrow({ where: { id: target.entityId } })).sourceExecutionId).toBe(row.id);
      else if (target.type === 'Execution') {
        const ex = await db.testExecution.findUniqueOrThrow({ where: { id: target.entityId } });
        expect(n.type === 'TestCase' ? ex.testCaseId : n.type === 'TestRun' ? ex.testRunId : ex.bugFixId).toBe(row.id);
      } else throw Error(`Unexpected relation ${n.type} -> ${target.type}`);
    }
  }
  const covered = data.nodes.find((n: any) => n.entityId === f.req.id);
  expect(covered.details.Coverage).toBe('Covered'); expect(covered.details['Linked cases']).toBe(14);
  expect(data.nodes.find((n: any) => n.entityId === f.partial.id).details.Coverage).toBe('Partial');
});

test('AUTHZ-8E-08: Viewer allow/read, foreign deny, missing scope and no mutation', async ({ browser }) => {
  const viewer = await browser.newContext({ baseURL: f.origin });
  const foreign = await browser.newContext({ baseURL: f.origin });
  try {
    for (const [context, actor] of [[viewer, f.actors.viewer], [foreign, f.actors.foreign]] as const) await context.addCookies([{ name: 'qa_session', value: actor.token, url: f.origin }]);
    await viewer.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//, r => r.abort());
    await viewer.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001/, ws => ws.close());
    const status = await viewer.request.get('/api/auth/status'); expect((await status.json()).user.id).toBe(f.actors.viewer.id);
    expect((await viewer.request.get(graphURL('TestCase', f.cases[0].id))).status()).toBe(200);
    expect((await viewer.request.get(graphURL('TestCase', f.foreignCase.id))).status()).toBe(404);
    expect((await viewer.request.get(graphURL('TestCase', f.foreignCase.id, f.foreign.id))).status()).toBe(403);
    expect((await foreign.request.get(graphURL('TestCase', f.foreignCase.id, f.foreign.id))).status()).toBe(200);
    expect((await viewer.request.get(graphURL('TestCase', undefined, f.project.id, 'PRIVATE'))).ok()).toBe(true);
    expect((await (await viewer.request.get(graphURL('TestCase', undefined, f.project.id, 'PRIVATE'))).json()).options).toEqual([]);
    expect([400, 403]).toContain((await viewer.request.get('/api/traceability/graph')).status());
    const before = await db.testCase.findUniqueOrThrow({ where: { id: f.cases[0].id } });
    expect((await viewer.request.put(`/api/testcases?projectId=${f.project.id}`, { headers: { Origin: f.origin }, data: { id: before.id, projectId: f.project.id, status: 'DONE' } })).status()).toBe(403);
    expect(await db.testCase.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before);
    const page = await viewer.newPage(); await openGraph(page); await choose(page);
    await expect(page.getByRole('button', { name: 'Buat Relation', exact: true })).toHaveCount(0);
    await detail(page).getByRole('button', { name: 'Buka testcase', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('AUTH-001');
    await expect(page.getByRole('button', { name: /Simpan perubahan|Hapus Test Case/ })).toHaveCount(0);
  } finally { await viewer.close(); await foreign.close(); }
});

test('FUNC-8E-09: unlinked requirement, no search results and empty project', async ({ page }) => {
  await openGraph(page); await choose(page, 'Requirement', 'REQ-UNLINKED');
  await expect(canvas(page).locator('[data-graph-node]')).toHaveCount(1);
  await expect(detail(page)).toContainText('Uncovered');
  await expect(detail(page)).toContainText('Belum ada hubungan pada area yang dimuat.');
  await page.getByRole('button', { name: 'Ganti object', exact: true }).click();
  await page.getByLabel('Cari nama atau ID').fill('NO-SUCH-OBJECT');
  await expect(page.getByText('Tidak ada object yang cocok pada project ini.', { exact: true })).toBeVisible();
  const empty = await page.request.get(graphURL('TestCase', undefined, f.empty.id)); expect((await empty.json()).options).toEqual([]);
});

test('FUNC-8E-10: API failure/retry, missing entity and rapid selection cancellation', async ({ page }) => {
  await openGraph(page);
  await page.route('**/api/traceability/graph?*', async route => {
    if (new URL(route.request().url()).searchParams.has('seedId')) { await route.fulfill({ status: 503, json: { error: 'Synthetic service unavailable' } }); return; }
    await route.continue();
  });
  await page.getByLabel('Cari nama atau ID').fill('AUTH-001'); await page.getByRole('button', { name: /^AUTH-001 —/ }).click();
  await expect(canvas(page).getByRole('alert')).toContainText('Synthetic service unavailable');
  await page.unroute('**/api/traceability/graph?*');
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click(); await expect(canvas(page).locator('[data-graph-node]')).not.toHaveCount(0);
  let release!: () => void, finished = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/traceability/graph?*', async route => {
    if (new URL(route.request().url()).searchParams.get('seedId') === f.cases[0].id) { const response = await route.fetch(); await gate; try { await route.fulfill({ response }); } catch { /* Aborted old request is expected. */ } finished = true; return; }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Ganti object', exact: true }).click(); await page.getByLabel('Cari nama atau ID').fill('AUTH-001'); await page.getByRole('button', { name: /^AUTH-001 —/ }).click();
  await expect(canvas(page).getByRole('status')).toContainText('Memuat relasi');
  await choose(page, 'Testcase', 'AUTH-002'); release();
  await expect.poll(() => finished).toBe(true);
  await expect(canvas(page).getByRole('button', { name: 'Testcase: AUTH-002, fokus graph', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect((await page.request.get(graphURL('TestCase', 'missing-seed'))).status()).toBe(404);
  await page.unroute('**/api/traceability/graph?*');
  await page.route('**/api/traceability/graph?*', async route => {
    if (new URL(route.request().url()).searchParams.get('seedId') === f.cases[2].id) await route.fulfill({ status: 404, json: { error: 'Object sudah tidak tersedia.' } });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Ganti object', exact: true }).click();
  await page.getByLabel('Cari nama atau ID').fill('AUTH-003'); await page.getByRole('button', { name: /^AUTH-003 —/ }).click();
  await expect(canvas(page).getByRole('alert')).toContainText('Object sudah tidak tersedia.');
  await choose(page, 'Testcase', 'AUTH-004');
  await expect(canvas(page).getByRole('button', { name: 'Testcase: AUTH-004, fokus graph', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('FUNC-8E-11: truncated requirement and change of loaded area', async ({ page }) => {
  await openGraph(page); await choose(page, 'Requirement', 'REQ-AUTH');
  await expect(page.getByText(/Sebagian hubungan tidak ditampilkan/)).toBeVisible();
  const data = await (await page.request.get(graphURL('Requirement', f.req.id))).json();
  expect(data.truncated).toBe(true); expect(data.nodes.filter((n: any) => n.type === 'TestCase')).toHaveLength(12);
  await choose(page, 'Testcase', 'AUTH-015');
  await expect(page.getByText(/Sebagian hubungan tidak ditampilkan/)).toHaveCount(0);
  await expect(canvas(page).getByRole('button', { name: 'Testcase: AUTH-015, fokus graph', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('VISUAL-8E-12: dark/light desktop, laptop and mobile evidence', async ({ page }) => {
  await openGraph(page); await choose(page);
  const out = path.join(root, 'after', process.env.QA_PHASE8E_RUN || 'candidate'); await fs.mkdir(out, { recursive: true });
  const measurements: Array<{ width: number; height: number; overflow: boolean; theme: string }> = [];
  for (const [width, height, theme] of [[1440, 900, 'dark'], [1440, 900, 'light'], [1366, 768, 'dark'], [390, 844, 'dark']] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate(t => { document.documentElement.classList.toggle('dark', t === 'dark'); document.documentElement.classList.toggle('light', t === 'light'); }, theme);
    await page.getByRole('button', { name: 'Reset tampilan', exact: true }).click();
    await expect(page.getByTestId('graph-zoom')).toHaveText('100%');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, `graph-${width}-${theme}.png`), fullPage: true });
    if (width === 1440 && theme === 'dark') await page.screenshot({ path: path.join(out, 'graph-final-1440x900.png') });
    const measured = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }));
    expect(measured.overflow).toBe(false); expect(measured.theme).toBe(theme);
    measurements.push({ width, height, ...measured });
  }
  await fs.writeFile(path.join(root, 'visual-measurements.json'), JSON.stringify(measurements, null, 2));
});
