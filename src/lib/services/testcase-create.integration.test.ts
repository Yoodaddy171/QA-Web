import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { importWorkbook } from '@/lib/services/excel-import-service';

// CREATE-FAILED-BUG-001: direct creation as FAILED must not bypass the Bug queue.
// Route + real transaction tests; authentication/proxy enforcement is not mocked
// as proof here. Every business record lives in a disposable SQLite database.
const fixture = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const temp = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temp, 'qadesk-create-failed-regression-'));
  return { temp, root, url: `file:${path.join(root, 'synthetic.db').replaceAll('\\', '/')}` };
});
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('@prisma/client');
  return { db: new PrismaClient({ datasourceUrl: fixture.url }) };
});
vi.mock('@/lib/request-actor', () => ({ getRequestActor: async () => ({ name: 'Synthetic create tester', userId: null }) }));

import { db } from '@/lib/db';
import { GET, POST, PUT } from '@/app/api/testcases/route';

let projectId: string;
let otherProjectId: string;
let moduleId: string;
const request = (method: string, body: unknown) => new NextRequest('http://localhost/api/testcases', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
function payload(overrides: Record<string, unknown> = {}) {
  return { projectId, moduleId, testCaseId: 'CREATE-001', page: 'Synthetic page', subMenu: 'Synthetic menu',
    testType: 'Negative', priority: 'High', testAction: 'Create a failed testcase directly',
    steps: 'Create via API', expectedResult: 'A linked Bug is present', actualResult: 'Not As Expected',
    status: 'FAILED', remarks: 'Keep this observation', tags: ['create-regression'], ...overrides };
}
const create = (overrides: Record<string, unknown> = {}) => POST(request('POST', payload(overrides)));
async function expectNoPartialRecords() {
  expect(await db.testCase.count()).toBe(0);
  expect(await db.bugFix.count()).toBe(0);
  expect(await db.activityHistory.count()).toBe(0);
}
beforeAll(async () => {
  if (path.dirname(fixture.root) !== fixture.temp || !path.basename(fixture.root).startsWith('qadesk-create-failed-regression-')) throw Error('Unsafe test root');
  await fs.writeFile(path.join(fixture.root, 'synthetic.db'), '', { flag: 'wx' });
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', path.resolve('prisma/sqlite.prisma'), '--skip-generate'], {
    env: { ...process.env, DATABASE_URL: fixture.url }, stdio: 'pipe', windowsHide: true,
  });
}, 60_000);
beforeEach(async () => {
  vi.restoreAllMocks();
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS create_bug_failure');
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS create_history_failure');
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS import_history_failure');
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS import_bug_failure');
  await db.workspace.deleteMany();
  const workspace = await db.workspace.create({ data: { name: 'Create regression workspace', slug: 'create-regression' } });
  projectId = (await db.project.create({ data: { workspaceId: workspace.id, name: 'Create project A' } })).id;
  otherProjectId = (await db.project.create({ data: { workspaceId: workspace.id, name: 'Create project B' } })).id;
  moduleId = (await db.module.create({ data: { projectId, name: 'Synthetic module' } })).id;
});

it('IMPORT-ATOMIC: activity failure rolls back the testcase and reports the failed row', async () => {
  await db.$executeRawUnsafe("CREATE TRIGGER import_history_failure BEFORE INSERT ON ActivityHistory WHEN NEW.action = 'IMPORTED' BEGIN SELECT RAISE(ABORT, 'synthetic activity failure'); END");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['ID','Page','Feature','Test','Expected Result','Status'], ['IMPORT-001','Login','Auth','Login check','Allowed','NOT DONE']]), 'Synthetic');
  const result = await importWorkbook(workbook, projectId, false);
  expect(result.imported).toBe(0);
  expect(result.sheets[0].errors).toEqual([{ row: 1, message: expect.stringContaining('dibatalkan') }]);
  await expectNoPartialRecords();
});

it('IMPORT-ATOMIC: bug failure rolls back only its row while the next valid row commits', async () => {
  await db.$executeRawUnsafe("CREATE TRIGGER import_bug_failure BEFORE INSERT ON BugFix BEGIN SELECT RAISE(ABORT, 'synthetic bug failure'); END");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['ID','Page','Feature','Test','Expected Result','Status'], ['IMPORT-FAILED','Login','Auth','Failed check','Allowed','FAILED'], ['IMPORT-OK','Login','Auth','Next check','Allowed','NOT DONE']]), 'Synthetic');
  const result = await importWorkbook(workbook, projectId, false);
  expect(result.imported).toBe(1); expect(result.sheets[0].skipped).toBe(1);
  expect(await db.testCase.count()).toBe(1); expect(await db.bugFix.count()).toBe(0); expect(await db.activityHistory.count()).toBe(1);
  expect((await db.testCase.findFirstOrThrow()).testCaseId).toBe('IMPORT-OK');
});

it('RUN-SUMMARY: grouped run totals omit testcase arrays and summary-only reads skip case pages', async () => {
  const created = await (await create({ status: 'NOT DONE', actualResult: '-' })).json();
  const run = await db.testRun.create({ data: { projectId, name: 'Summary fixture' } });
  await db.testRunCase.create({ data: { testRunId: run.id, testCaseId: created.id, latestStatus: 'FAILED' } });
  const { listTestRuns, getTestRun } = await import('@/lib/services/test-run-service');
  const page = await listTestRuns(projectId);
  expect(page.items[0].summary).toMatchObject({ total: 1, failed: 1, completed: 1 });
  expect(page.items[0]).not.toHaveProperty('testCases');
  expect(await getTestRun(projectId, run.id, { summaryOnly: true })).toMatchObject({ summary: { total: 1, failed: 1 }, testCases: [] });
});

it('REPORT-SUMMARY: list projection retains card metrics without document sections or metadata', async () => {
  await db.report.create({ data: { projectId, version: '1.0', reportType: 'TEST_STATUS_REPORT', reportingPeriodStart: new Date(), reportingPeriodEnd: new Date(), metricsSnapshot: { totalPassed: 4, totalFailed: 2, passRate: 66.7 }, sectionsJson: { scope: 'Detail only' }, metadataJson: { documentInformation: 'Detail only' } } });
  const { getProjectReports } = await import('@/lib/services/report-generator');
  const summary = await getProjectReports(projectId, { summaryOnly: true, limit: 1 });
  expect(summary.items[0]).toMatchObject({ metrics: { totalPassed: 4, totalFailed: 2, passRate: 66.7 } });
  expect(summary.items[0]).not.toHaveProperty('sections'); expect(summary.items[0]).not.toHaveProperty('metadata');
  const legacy = await getProjectReports(projectId);
  expect(legacy.items[0]).toHaveProperty('sections.scope', 'Detail only');
});

it('REPORT-PAGINATION: filters the entire project before taking a cursor page and returns scoped counts', async () => {
  const { getProjectReports } = await import('@/lib/services/report-generator');
  const base = { projectId, reportingPeriodStart: new Date('2026-01-01'), reportingPeriodEnd: new Date('2026-01-02'), metricsSnapshot: {} };
  await db.report.createMany({ data: Array.from({ length: 30 }, (_, index) => ({
    ...base, version: `1.${index}`, reportType: 'TEST_STATUS_REPORT', status: 'DRAFT', createdAt: new Date(2026, 1, index + 1),
  })) });
  const older = await db.report.create({ data: { ...base, version: '2.0', reportType: 'TEST_PLANNING', status: 'FINAL', createdAt: new Date('2025-01-01') } });
  await db.report.create({ data: { ...base, projectId: otherProjectId, version: '2.0', reportType: 'TEST_PLANNING_DOCUMENT', status: 'FINAL' } });

  const first = await getProjectReports(projectId, { summaryOnly: true, limit: 25 });
  expect(first.items).toHaveLength(25);
  expect(first.items.some(item => item.id === older.id)).toBe(false);
  expect(first).toMatchObject({ total: 31, matchedTotal: 31, hasMore: true });
  const filtered = await getProjectReports(projectId, { summaryOnly: true, limit: 25, filters: { search: '  TEST PLANNING  ', type: 'TEST_PLANNING_DOCUMENT', status: 'FINAL' } });
  expect(filtered.items.map(item => item.id)).toEqual([older.id]);
  expect(filtered).toMatchObject({ total: 31, matchedTotal: 1, hasMore: false });

  const byVersion = await getProjectReports(projectId, { summaryOnly: true, filters: { search: ' V2.0 ' } });
  expect(byVersion.items.map(item => item.id)).toEqual([older.id]);
  const drafts = await getProjectReports(projectId, { summaryOnly: true, limit: 25, filters: { status: 'DRAFT' } });
  const next = await getProjectReports(projectId, { summaryOnly: true, limit: 25, cursor: drafts.nextCursor!, filters: { status: 'DRAFT' } });
  expect(next.items).toHaveLength(5);
  expect(new Set([...drafts.items, ...next.items].map(item => item.id)).size).toBe(30);
  expect(next).toMatchObject({ total: 31, matchedTotal: 30, hasMore: false });
  const byProject = await getProjectReports(projectId, { summaryOnly: true, filters: { search: ' CREATE PROJECT A ' } });
  expect(byProject).toMatchObject({ total: 31, matchedTotal: 31 });
});

it('REPORT-PAGINATION: API forwards filters/counts and rejects invalid filter values', async () => {
  const { GET } = await import('@/app/api/reports/route');
  for (const suffix of ['status=WRONG', 'type=WRONG', `search=${'x'.repeat(201)}`]) {
    expect((await GET(new NextRequest(`http://localhost/api/reports?projectId=${projectId}&${suffix}`))).status).toBe(400);
  }
  const base = { projectId, reportingPeriodStart: new Date('2026-01-01'), reportingPeriodEnd: new Date('2026-01-02'), metricsSnapshot: {} };
  const matching = await db.report.create({ data: { ...base, version: '2.0', reportType: 'TEST_PLANNING_DOCUMENT', status: 'FINAL' } });
  await db.report.create({ data: { ...base, version: '1.0', reportType: 'TEST_STATUS_REPORT', status: 'DRAFT' } });
  const response = await GET(new NextRequest(`http://localhost/api/reports?projectId=${projectId}&view=summary&status=FINAL&type=TEST_PLANNING_DOCUMENT&search=%20V2.0%20`));
  const body = await response.json();
  expect(body).toMatchObject({ total: 2, matchedTotal: 1, hasMore: false });
  expect(body.reports.map((report: { id: string }) => report.id)).toEqual([matching.id]);
});
afterAll(async () => {
  await db.$disconnect();
  if (path.dirname(fixture.root) !== fixture.temp || !path.basename(fixture.root).startsWith('qadesk-create-failed-regression-')) throw Error('Unsafe cleanup root');
  await fs.rm(fixture.root, { recursive: true, force: true });
});

it('CREATE-FAILED-BUG-001: creates one linked reported Bug with the source snapshot and unchanged API response', async () => {
  const response = await create();
  expect(response.status).toBe(201);
  const created = await response.json();
  expect(created).toMatchObject({ testCaseId: 'CREATE-001', status: 'FAILED', projectId, moduleId, progress: 0, remarks: 'Keep this observation' });
  expect(created.id).toEqual(expect.any(String));
  expect(created.module.name).toBe('Synthetic module');
  const bugs = await db.bugFix.findMany();
  expect(bugs).toHaveLength(1);
  expect(bugs[0]).toMatchObject({ sourceTestCaseId: created.id, testCaseId: created.testCaseId, projectId, moduleId,
    page: created.page, subMenu: created.subMenu, testType: created.testType, testAction: created.testAction,
    steps: created.steps, expectedResult: created.expectedResult, priority: 'High', actualResult: 'Not As Expected', status: 'SUDAH DILAPORKAN' });
  expect(await db.testCase.findUnique({ where: { id: created.id } })).toMatchObject({ status: 'FAILED', remarks: 'Keep this observation' });
  expect(await db.activityHistory.findMany()).toEqual([expect.objectContaining({ entityType: 'TestCase', entityId: created.id, action: 'CREATED', projectId, actor: 'Synthetic create tester' })]);
});

it('CREATE-FAILED-BUG-001: status FAILED alone creates a Bug even when actualResult is omitted', async () => {
  const response = await create({ actualResult: undefined });
  expect(response.status).toBe(201);
  const created = await response.json();
  expect(created.actualResult).toBeNull();
  expect(await db.bugFix.findFirst()).toMatchObject({ sourceTestCaseId: created.id, actualResult: 'Not As Expected', status: 'SUDAH DILAPORKAN' });
});

it.each(['DONE', 'NOT DONE', 'IN PROGRESS', 'BLOCKED', 'READY TO RETEST', 'TBA'])('CREATE-FAILED-BUG-001: create %s does not add an unwanted Bug', async status => {
  const response = await create({ status, actualResult: status === 'DONE' ? 'As Expected' : '-' });
  expect(response.status).toBe(201);
  expect((await response.json()).status).toBe(status);
  expect(await db.testCase.count()).toBe(1);
  expect(await db.bugFix.count()).toBe(0);
  expect(await db.activityHistory.count()).toBe(1);
});

it('CREATE-FAILED-BUG-001: duplicate POST and subsequent FAILED update do not duplicate Bugs', async () => {
  const first = await create();
  expect(first.status).toBe(201);
  const created = await first.json();
  expect((await create()).status).toBe(409);
  expect((await PUT(request('PUT', { id: created.id, status: 'FAILED' }))).status).toBe(200);
  expect(await db.testCase.count()).toBe(1);
  expect(await db.bugFix.count()).toBe(1);
  expect(await db.bugFix.findFirst()).toMatchObject({ sourceTestCaseId: created.id, status: 'SUDAH DILAPORKAN' });
});

it('CREATE-FAILED-BUG-001: the same display ID in another project gets its own correctly linked Bug', async () => {
  expect((await create()).status).toBe(201);
  const second = await create({ projectId: otherProjectId, moduleId: null });
  expect(second.status).toBe(201);
  const created = await second.json();
  expect(await db.bugFix.count()).toBe(2);
  expect(await db.bugFix.count({ where: { projectId } })).toBe(1);
  expect(await db.bugFix.findFirst({ where: { projectId: otherProjectId } })).toMatchObject({ sourceTestCaseId: created.id, moduleId: null });
});

it('CREATE-FAILED-BUG-001: failed Bug insert rolls back testcase and history; a retry creates exactly one pair', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await db.$executeRawUnsafe("CREATE TRIGGER create_bug_failure BEFORE INSERT ON BugFix BEGIN SELECT RAISE(ABORT, 'Injected Bug insert failure'); END");
  expect((await create()).status).toBe(500);
  await expectNoPartialRecords();
  await db.$executeRawUnsafe('DROP TRIGGER create_bug_failure');
  expect((await create()).status).toBe(201);
  expect(await db.testCase.count()).toBe(1);
  expect(await db.bugFix.count()).toBe(1);
  expect(await db.activityHistory.count()).toBe(1);
});

it('CREATE-FAILED-BUG-001: failed history insert also rolls back the already-created testcase and Bug', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await db.$executeRawUnsafe("CREATE TRIGGER create_history_failure BEFORE INSERT ON ActivityHistory BEGIN SELECT RAISE(ABORT, 'Injected history failure'); END");
  expect((await create()).status).toBe(500);
  await expectNoPartialRecords();
});

it('LATEST-SORT-001: newest combines creation and edits across pages within the filtered project', async () => {
  const first = await (await create({ status: 'NOT DONE', actualResult: '-', testCaseId: 'OLD-001' })).json();
  const second = await (await create({ status: 'NOT DONE', actualResult: '-', testCaseId: 'NEW-001' })).json();
  await db.testCase.update({ where: { id: first.id }, data: { createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-01') } });
  await db.testCase.update({ where: { id: second.id }, data: { createdAt: new Date('2021-01-01'), updatedAt: new Date('2021-01-01') } });
  await create({ projectId: otherProjectId, moduleId: null, status: 'NOT DONE', actualResult: '-', testCaseId: 'FOREIGN-001' });
  const read = async (page: number) => {
    const response = await GET(new NextRequest(`http://localhost/api/testcases?projectId=${projectId}&status=NOT%20DONE&sortBy=updatedAt&sortOrder=desc&limit=1&page=${page}`));
    expect(response.status).toBe(200);
    return response.json();
  };
  expect((await read(1)).testCases.map((row: { id: string }) => row.id)).toEqual([second.id]);
  expect((await read(2)).testCases.map((row: { id: string }) => row.id)).toEqual([first.id]);
  expect((await PUT(request('PUT', { id: first.id, testAction: 'An old testcase edited most recently' }))).status).toBe(200);
  const latest = await read(1);
  expect(latest).toMatchObject({ total: 2, totalPages: 2, page: 1 });
  expect(latest.testCases.map((row: { id: string }) => row.id)).toEqual([first.id]);
  expect((await read(2)).testCases.map((row: { id: string }) => row.id)).toEqual([second.id]);
});
