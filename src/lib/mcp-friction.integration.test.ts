import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const fixture = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qadesk-mcp-friction-regression-'));
  process.env.QA_EVIDENCE_STORAGE_DIR = path.join(root, 'evidence');
  return { root, url: `file:${path.join(root, 'synthetic.db').replaceAll('\\', '/')}` };
});
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('@prisma/client');
  return { db: new PrismaClient({ datasourceUrl: fixture.url, log: [] }) };
});
vi.mock('@/lib/request-actor', () => ({ getRequestActor: async () => ({ name: 'Synthetic MCP tester', userId: null }) }));

import { db } from '@/lib/db';
import * as executions from '@/app/api/test-runs/[id]/executions/route';
import * as uploads from '@/app/api/test-runs/[id]/executions/[executionId]/evidence/route';
import { bulkExecuteTestCases, createTestExecution, updateTestExecution, getTestRunCasesPage } from '@/lib/services/test-run-service';
import * as notifications from '@/lib/services/notification-service';

let projectId: string, caseId: string, runId: string;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK6kAAAAASUVORK5CYII=', 'base64');
const request = (body: unknown) => new NextRequest('http://localhost/api/test-runs/fixture/executions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const execute = (status = 'PASSED', extra = {}) => createTestExecution({ projectId, testRunId: runId, testCaseId: caseId, status, actualResult: 'Synthetic observed result', ...extra });
const readCase = () => db.testCase.findUniqueOrThrow({ where: { id: caseId } });
async function upload(executionId: string, files: Array<{ bytes?: Buffer; type?: string; name?: string }>, replaceEvidenceId?: string) {
  const body = new FormData();
  for (const file of files) body.append('file', new Blob([new Uint8Array(file.bytes ?? png)], { type: file.type ?? 'image/png' }), file.name ?? 'fixture.png');
  if (replaceEvidenceId) body.set('replaceEvidenceId', replaceEvidenceId);
  return uploads.POST(new NextRequest(`http://localhost/api/test-runs/${runId}/executions/${executionId}/evidence?projectId=${projectId}`, { method: 'POST', body }), { params: Promise.resolve({ id: runId, executionId }) });
}
beforeAll(async () => {
  await fs.writeFile(path.join(fixture.root, 'synthetic.db'), '');
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', path.resolve('prisma/sqlite.prisma'), '--skip-generate'], { env: { ...process.env, DATABASE_URL: fixture.url }, stdio: 'pipe' });
}, 60_000);
beforeEach(async () => {
  vi.restoreAllMocks();
  await db.workspace.deleteMany();
  await fs.rm(path.join(fixture.root, 'evidence'), { recursive: true, force: true });
  const workspace = await db.workspace.create({ data: { name: 'Synthetic regression', slug: 'mcp-regression' } });
  const project = await db.project.create({ data: { name: 'MCP regression', workspaceId: workspace.id } });
  projectId = project.id;
  const c = await db.testCase.create({ data: { projectId, testCaseId: 'CRS-04', page: 'Synthetic', testType: 'Positive', testAction: 'Observe result', steps: 'Execute fixture', expectedResult: 'Fixture result', status: 'NOT DONE', actualResult: '-' } });
  caseId = c.id;
  runId = (await db.testRun.create({ data: { projectId, name: 'Synthetic cycle' } })).id;
});
afterAll(async () => { await db.$disconnect(); await fs.rm(fixture.root, { recursive: true, force: true }); });

it.each([['PASSED','DONE','As Expected'], ['FAILED','FAILED','Not As Expected'], ['BLOCKED','BLOCKED','-'], ['VERIFIED','DONE','As Expected'], ['IN PROGRESS','IN PROGRESS','-'], ['RETEST','READY TO RETEST','-']])('SYNC: %s persists matching case badge, membership and result atomically', async (status, expectedStatus, badge) => {
  const result = await execute(status);
  expect(result.testCaseSync).toMatchObject({ applied: true, status: expectedStatus, actualResult: badge });
  expect(await readCase()).toMatchObject({ status: expectedStatus, actualResult: badge });
  expect(await db.testRunCase.findUnique({ where: { id: result.testRunCaseId! } })).toMatchObject({ latestStatus: status });
  expect(await db.testExecution.findUnique({ where: { id: result.id } })).toMatchObject({ actualResult: 'Synthetic observed result' });
  if (status === 'FAILED') expect(await db.bugFix.count({ where: { sourceTestCaseId: caseId } })).toBe(1);
});
it('SYNC: NOT RUN preserves an existing result and warns rather than resetting the badge', async () => {
  await execute(); const result = await execute('NOT RUN');
  expect(result.testCaseSync).toMatchObject({ applied: false, reason: 'NO_VERDICT', status: 'DONE' });
  expect(result.testCaseSync.warning).toBeTruthy(); expect((await readCase()).status).toBe('DONE');
});
it('SYNC: older results in the same run and another run cannot overwrite latest case/membership', async () => {
  const latest = await execute('PASSED', { completedAt: new Date('2026-10-19T10:00:00Z'), startedAt: new Date('2026-10-19T09:00:00Z') });
  const old = await execute('FAILED', { completedAt: new Date('2026-09-01T10:00:00Z'), startedAt: new Date('2026-09-01T09:00:00Z') });
  expect(old.testCaseSync.reason).toBe('HISTORICAL_EXECUTION');
  expect((await readCase()).status).toBe('DONE');
  expect(await db.testRunCase.findUnique({ where: { id: latest.testRunCaseId! } })).toMatchObject({ latestStatus: 'PASSED' });
  expect((await getTestRunCasesPage(projectId, runId))?.items[0].executions[0].id).toBe(latest.id);
  const run2 = await db.testRun.create({ data: { projectId, name: 'Historical import' } });
  const other = await execute('BLOCKED', { testRunId: run2.id, startedAt: new Date('2026-08-01') });
  expect(other.testCaseSync.reason).toBe('HISTORICAL_EXECUTION');
  expect((await readCase()).status).toBe('DONE');
  expect(await db.bugFix.count()).toBe(0);
});
it('SYNC: updating an old execution leaves the latest verdict; updating latest synchronizes and fixes/reopens its bug', async () => {
  const old = await execute('BLOCKED', { completedAt: new Date('2026-09-01') });
  const latest = await execute('FAILED', { completedAt: new Date('2026-10-01') });
  expect((await updateTestExecution(projectId, old.id, { status: 'PASSED' }))?.testCaseSync.reason).toBe('HISTORICAL_EXECUTION');
  expect((await readCase()).status).toBe('FAILED');
  await updateTestExecution(projectId, latest.id, { status: 'VERIFIED' });
  expect((await readCase()).status).toBe('DONE');
  expect(await db.bugFix.findFirst()).toMatchObject({ status: 'VERIFIED & FIXED' });
  await updateTestExecution(projectId, latest.id, { status: 'FAILED' });
  expect((await readCase()).status).toBe('FAILED');
  expect(await db.bugFix.findFirst()).toMatchObject({ status: 'SUDAH DILAPORKAN' });
});
it('SYNC: rollback includes case, execution, membership and bug on notification failure', async () => {
  vi.spyOn(notifications, 'createNotification').mockRejectedValueOnce(new Error('Injected notification failure'));
  await expect(execute('FAILED')).rejects.toThrow('Injected notification failure');
  expect((await readCase()).status).toBe('NOT DONE');
  expect(await db.testExecution.count()).toBe(0);
  expect(await db.testRunCase.count()).toBe(0);
  expect(await db.bugFix.count()).toBe(0);
  expect(await db.activityHistory.count()).toBe(0);
});
it('ID-DISPLAY: create and filter accept display ID and return resolved internal ID', async () => {
  const response = await executions.POST(request({ projectId, testCaseId: 'CRS-04', status: 'PASSED' }), { params: Promise.resolve({ id: runId }) });
  expect(response.status).toBe(201);
  const execution = await response.json(); expect(execution.testCaseId).toBe(caseId);
  const list = await executions.GET(new NextRequest(`http://localhost/api/test-runs/${runId}/executions?projectId=${projectId}&testCaseId=CRS-04`), { params: Promise.resolve({ id: runId }) });
  expect((await list.json()).executions).toHaveLength(1);
});
it.each(['case','run'])('ID-TYPO: unknown %s yields 404 and leaves all data unchanged', async kind => {
  const response = await executions.POST(request({ projectId, testCaseId: kind === 'case' ? 'unknown-case' : 'CRS-04', status: 'PASSED' }), { params: Promise.resolve({ id: kind === 'run' ? 'unknown-run' : runId }) });
  expect(response.status).toBe(404); expect(await db.testExecution.count()).toBe(0); expect(await db.testRunCase.count()).toBe(0);
  expect((await readCase()).status).toBe('NOT DONE');
});
it('ID-SCOPE: duplicate display ID in another project cannot select that project case', async () => {
  const foreign = await db.project.create({ data: { workspaceId: (await db.project.findUniqueOrThrow({ where: { id: projectId } })).workspaceId, name: 'Other project' } });
  const c = await readCase();
  const foreignCase = await db.testCase.create({ data: { projectId: foreign.id, testCaseId: c.testCaseId, page: c.page, steps: c.steps, testAction: c.testAction, expectedResult: c.expectedResult, testType: c.testType, status: 'NOT DONE' } });
  expect((await execute('PASSED', { testCaseId: 'CRS-04' })).testCaseId).toBe(caseId);
  await expect(execute('FAILED', { testCaseId: foreignCase.id })).rejects.toMatchObject({ status: 404 });
  expect(await db.testCase.findUnique({ where: { id: foreignCase.id } })).toMatchObject({ status: 'NOT DONE' });
});
it('ID-AMBIGUOUS: an internal ID matching a different display ID returns conflict', async () => {
  await db.testCase.create({ data: { projectId, testCaseId: caseId, page: 'Fixture', steps: 'Fixture', testAction: 'Fixture', expectedResult: 'Fixture', testType: 'Positive' } });
  await expect(execute()).rejects.toMatchObject({ status: 409 }); expect(await db.testExecution.count()).toBe(0);
});
it('SYNC-BULK: mixed display/internal aliases are deduplicated and update the badge once', async () => {
  const result = await bulkExecuteTestCases({ projectId, testRunId: runId, testCaseIds: ['CRS-04',caseId], status: 'BLOCKED' });
  expect(result.executed).toBe(1); expect((await readCase()).status).toBe('BLOCKED'); expect(await db.testExecution.count()).toBe(1);
});
it('FILE-MULTI: saves all files, reports count and reads both evidence rows', async () => {
  const execution = await execute();
  const response = await upload(execution.id, [{name:'first.png'},{name:'second.png'}]);
  expect(response.status).toBe(201); expect(await response.json()).toMatchObject({ uploadedCount: 2, evidence: [{ fileName: 'first.png' }, { fileName: 'second.png' }] });
  const stored = await db.testExecutionEvidence.findMany(); expect(stored).toHaveLength(2);
  for (const row of stored) expect(await fs.readFile(path.join(fixture.root,'evidence',row.storagePath))).toEqual(png);
});
it('FILE-MIME: generic MIME is detected, explicit wrong MIME still rejected, single-file response preserved', async () => {
  const execution = await execute();
  const valid = await upload(execution.id, [{type:'application/octet-stream',name:'fixture.bin'}]);
  expect(valid.status).toBe(201); expect(await valid.json()).toMatchObject({ executionId: execution.id, mimeType: 'image/png' });
  const invalid = await upload(execution.id, [{type:'image/jpeg'}]);
  expect(invalid.status).toBe(400); expect(await db.testExecutionEvidence.count()).toBe(1);
});
it('FILE-MULTI: one invalid file rejects the full batch without storing any evidence', async () => {
  const execution = await execute();
  expect((await upload(execution.id,[{}, {bytes:Buffer.from('MZ not an image')}])).status).toBe(400);
  expect(await db.testExecutionEvidence.count()).toBe(0);
});
it('FILE-MULTI: database failure cleans all staged files and leaves no metadata', async () => {
  const execution = await execute();
  vi.spyOn(db, '$transaction').mockRejectedValueOnce(new Error('Injected database failure'));
  expect((await upload(execution.id,[{},{}])).status).toBe(500);
  expect(await db.testExecutionEvidence.count()).toBe(0);
  const directory=path.join(fixture.root,'evidence',projectId,execution.id);
  expect(await fs.readdir(directory)).toHaveLength(0);
});
it('FILE-QUOTA: combined batch is rejected and staged files cleaned when project is full', async () => {
  const execution = await execute();
  await db.testExecutionEvidence.create({ data: { executionId: execution.id, fileName: 'quota-fixture.png', mimeType: 'image/png', sizeBytes: 1024 * 1024 * 1024, storagePath: 'synthetic-existing-quota-row' } });
  expect((await upload(execution.id,[{},{}])).status).toBe(413);
  expect(await db.testExecutionEvidence.count()).toBe(1);
  expect(await fs.readdir(path.join(fixture.root,'evidence',projectId,execution.id))).toHaveLength(0);
});
it('FILE-REPLACE: replacing multiple files is rejected; one-file replacement preserves contract', async () => {
  const execution=await execute();
  const first=await (await upload(execution.id,[{}])).json();
  expect((await upload(execution.id,[{},{}],first.id)).status).toBe(400);
  const response=await upload(execution.id,[{name:'replacement.png'}],first.id);
  expect(response.status).toBe(201);expect(await db.testExecutionEvidence.count()).toBe(1);
  expect(await db.testExecutionEvidence.findUnique({where:{id:first.id}})).toBeNull();
});
