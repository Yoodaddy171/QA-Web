import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { seedAuthorizationFixture } from '../../scripts/phase6b-fixture.mjs';

const fixture = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qadesk-phase6b-'));
  process.env.QA_RUNTIME_DIR = root;
  return { root, url: `file:${path.join(root, 'synthetic.db').replaceAll('\\', '/')}`, headers: new AsyncLocalStorage<Headers>() };
});
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('@prisma/client');
  return { db: new PrismaClient({ datasourceUrl: fixture.url, log: [] }) };
});
vi.mock('@/lib/devlog-db', async () => ({ devlogDb: (await import('@/lib/db')).db }));
vi.mock('next/headers', () => ({ headers: async () => fixture.headers.getStore() || new Headers() }));

import { db } from '@/lib/db';
import { proxy } from '@/proxy';
import * as cases from '@/app/api/testcases/route';
import * as bugs from '@/app/api/bugfix/route';
import * as reports from '@/app/api/reports/[id]/route';
import { GET as evidenceHtml } from '@/app/api/evidence/route';
import { POST as importExcel } from '@/app/api/excel/route';
import * as XLSX from 'xlsx';
import * as members from '@/app/api/workspaces/members/route';
import * as projects from '@/app/api/projects/route';
import { POST as finalizeReport } from '@/app/api/reports/[id]/finalize/route';
import * as runCases from '@/app/api/test-runs/[id]/cases/route';
import { PUT as updateExecution } from '@/app/api/test-runs/[id]/executions/route';
import { POST as bulkExecute } from '@/app/api/test-runs/[id]/executions/bulk/route';
import { GET as evidenceList } from '@/app/api/test-runs/[id]/executions/[executionId]/evidence/route';
import { GET as evidenceFile } from '@/app/api/test-runs/[id]/executions/[executionId]/evidence/[evidenceId]/route';
import { POST as linkRequirement } from '@/app/api/requirements/[id]/test-cases/route';
import { GET as traceability } from '@/app/api/traceability/route';
import { GET as automationHistory } from '@/app/api/automation/history/route';
import { PUT as settingsPut } from '@/app/api/settings/ai/route';
import { GET as listModules } from '@/app/api/modules/route';

let data: Awaited<ReturnType<typeof seedAuthorizationFixture>>;
type Actor = 'viewer' | 'qa' | 'lead' | 'admin' | 'owner' | 'foreign' | 'none' | 'multi';
function request(url: string, actor: Actor = 'qa', method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${url}`, { method, headers: {
    origin: 'http://localhost', host: 'localhost', Cookie: `qa_session=${data.actors[actor].token}`,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers,
  }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
}
async function dispatch(req: NextRequest, handler: (req: NextRequest) => Promise<Response>) {
  const decision = await proxy(req);
  if (decision.headers.get('x-middleware-next') !== '1') return decision;
  const headers = new Headers(req.headers);
  for (const [name, value] of decision.headers) if (name.startsWith('x-middleware-request-')) headers.set(name.slice('x-middleware-request-'.length), value);
  return fixture.headers.run(headers, () => handler(req));
}
async function snapshot() {
  return { cases: await db.testCase.findMany({ orderBy: { id: 'asc' } }), bugs: await db.bugFix.findMany({ orderBy: { id: 'asc' } }), history: await db.activityHistory.findMany({ orderBy: { id: 'asc' } }),
    reports: await db.report.findMany({ orderBy: { id: 'asc' } }), executions: await db.testExecution.findMany({ orderBy: { id: 'asc' } }),
    runCases: await db.testRunCase.findMany({ orderBy: { id: 'asc' } }), links: await db.requirementTestCase.findMany({ orderBy: { id: 'asc' } }),
    evidence: await db.testExecutionEvidence.findMany({ orderBy: { id: 'asc' } }), notifications: await db.notification.findMany({ orderBy: { id: 'asc' } }) };
}

beforeAll(async () => {
  await fs.writeFile(path.join(fixture.root, 'synthetic.db'), '');
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', path.resolve('prisma/sqlite.prisma'), '--skip-generate'], { env: { ...process.env, DATABASE_URL: fixture.url }, stdio: 'pipe' });
}, 60_000);
beforeEach(async () => {
  vi.restoreAllMocks();
  await db.workspace.deleteMany(); await db.user.deleteMany();
  data = await seedAuthorizationFixture(db);
});
afterAll(async () => { await db.$disconnect(); await fs.rm(fixture.root, { recursive: true, force: true }); });

it.each(['testcases', 'bugfix'])('6B-SCOPE: %s list cannot use one authorized ID to read all workspaces', async endpoint => {
  const a = data.resources.a;
  const response = await dispatch(request(`/api/${endpoint}?id=${endpoint === 'testcases' ? a.tc.id : a.bug.id}`), endpoint === 'testcases' ? cases.GET : bugs.GET);
  expect(response.status).toBe(400);
  expect(await response.text()).not.toContain(data.resources.b.tc.id);
});

it('6B-QUERY-BODY: an authorized query cannot override a foreign body project for creation', async () => {
  const before = await snapshot();
  const response = await dispatch(request(`/api/testcases?projectId=${data.resources.a.project.id}`, 'qa', 'POST', {
    projectId: data.resources.b.project.id, testCaseId: 'FOREIGN-CREATE', page: 'Synthetic', testAction: 'Submit', steps: 'Click', expectedResult: 'Saved',
  }), cases.POST);
  expect(await snapshot()).toEqual(before);
  expect(response.status).toBe(403);
});

it.each(['plain', 'oversize', 'streamed'])('6B-BODY: %s JSON must not hide a foreign mutation ID from authorization', async kind => {
  const before = await snapshot();
  const response = await dispatch(request(`/api/bugfix?projectId=${data.resources.a.project.id}`, 'qa', 'PUT', {
    id: data.resources.b.bug.id, status: 'READY TO RETEST', ...(kind !== 'plain' ? { padding: 'x'.repeat(1_000_001) } : {}),
  }, kind === 'plain' ? { 'Content-Type': 'text/plain' } : kind === 'oversize' ? { 'Content-Length': '1000100' } : {}), bugs.PUT);
  expect(await snapshot()).toEqual(before);
  expect([400, 403, 413, 415]).toContain(response.status);
});

it('6B-PATH: encoded report ID cannot bypass persisted ownership resolution', async () => {
  const id = data.resources.b.report.id;
  const encoded = `%${id.charCodeAt(0).toString(16)}${id.slice(1)}`;
  const response = await dispatch(request(`/api/reports/${encoded}?projectId=${data.resources.a.project.id}`), req => reports.GET(req, { params: Promise.resolve({ id }) }));
  expect([403, 404]).toContain(response.status);
  expect(await response.text()).not.toContain('SYNTHETIC-b-REPORT');
});

it('6B-EVIDENCE: duplicate display IDs cannot select another workspace automation logs', async () => {
  const a = data.resources.a;
  const response = await dispatch(request(`/api/evidence?projectId=${a.project.id}&testCaseId=${a.tc.id}`), evidenceHtml);
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain('SYNTHETIC-a-PRIVATE-LOG');
  expect(html).not.toContain('SYNTHETIC-b-PRIVATE-LOG');
});

it.each(['separator', 'next-id', 'read-all'])('6B1-PATH: %s report ID retains its actual workspace', async kind => {
  const a = data.resources.a, b = data.resources.b;
  const foreignReport = await db.report.create({ data: {
    id: kind === 'separator' ? `${a.report.id}/foreign` : kind, projectId: b.project.id, version: 'custom',
    reportType: 'TEST_PLANNING_DOCUMENT', metricsSnapshot: {},
    reportingPeriodStart: new Date('2020-01-01'), reportingPeriodEnd: new Date('2020-01-02'),
    progressNarrative: 'SYNTHETIC-SLASH-PRIVATE',
  } });
  const endpoint = `/api/reports/${encodeURIComponent(foreignReport.id)}?projectId=${a.project.id}`;
  const handler = (req: NextRequest) => reports.GET(req, { params: Promise.resolve({ id: foreignReport.id }) });
  const before = await snapshot();
  const denied = await dispatch(request(endpoint), handler);
  expect(denied.status).toBe(403);
  expect(await denied.text()).not.toContain('SYNTHETIC-SLASH-PRIVATE');
  const mutation = await dispatch(request(endpoint, 'qa', 'PATCH', { author: 'Unauthorized' }), req => reports.PATCH(req, { params: Promise.resolve({ id: foreignReport.id }) }));
  expect(mutation.status).toBe(403);
  const allowed = await dispatch(request(`/api/reports/${encodeURIComponent(foreignReport.id)}`, 'foreign'), handler);
  expect(allowed.status).toBe(200);
  expect((await allowed.json()).report.id).toBe(foreignReport.id);
  expect(await snapshot()).toEqual(before);
});

it('6B-MULTIPART: an authorized query cannot select a foreign Excel form project', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ ID: 'SHARED-001', Page: 'Synthetic', Feature: 'Submit', Test: 'Synthetic', Step: 'Click', 'Expected Result': 'Saved', Status: 'NOT DONE' }]), 'Synthetic');
  const form = new FormData();
  form.set('projectId', data.resources.b.project.id);
  form.set('mode', 'preview');
  form.set('file', new File([XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })], 'synthetic.xlsx'));
  const req = new NextRequest(`http://localhost/api/excel?projectId=${data.resources.a.project.id}`, { method: 'POST', headers: { origin: 'http://localhost', host: 'localhost', Cookie: `qa_session=${data.actors.qa.token}` }, body: form });
  const before = await snapshot();
  const response = await dispatch(req, importExcel);
  expect(response.status).toBe(400);
  expect(await snapshot()).toEqual(before);
});

it('6B-MULTIPART: matching authorized Excel project still supports a valid preview', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ ID: 'UNIQUE-PREVIEW', Page: 'Synthetic', Feature: 'Submit', Test: 'Synthetic', Step: 'Click', 'Expected Result': 'Saved', Status: 'NOT DONE' }]), 'Synthetic');
  const form = new FormData();
  form.set('projectId', data.resources.a.project.id); form.set('mode', 'preview');
  form.set('file', new File([XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })], 'synthetic.xlsx'));
  const req = new NextRequest(`http://localhost/api/excel?projectId=${data.resources.a.project.id}`, { method: 'POST', headers: { origin: 'http://localhost', host: 'localhost', Cookie: `qa_session=${data.actors.qa.token}` }, body: form });
  const response = await dispatch(req, importExcel);
  expect(response.status).toBe(200);
  expect((await response.json()).canImport).toBe(true);
});

it('6B-SCOPE: the adjacent Modules collection also requires an explicit project', async () => {
  const moduleRecord = await db.module.create({ data: { projectId: data.resources.a.project.id, name: 'Synthetic module' } });
  const denied = await dispatch(request(`/api/modules?id=${moduleRecord.id}`), listModules);
  expect(denied.status).toBe(400);
  const allowed = await dispatch(request(`/api/modules?projectId=${data.resources.a.project.id}`), listModules);
  expect(allowed.status).toBe(200);
});

it('6B-ERROR: evidence failure does not expose internal exception details', async () => {
  const spy = vi.spyOn(db.testCase, 'findFirst').mockRejectedValueOnce(new Error('SYNTHETIC-PRIVATE-SQL-PATH'));
  const a = data.resources.a;
  const response = await dispatch(request(`/api/evidence?projectId=${a.project.id}&testCaseId=${a.tc.id}`), evidenceHtml);
  spy.mockRestore();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain('SYNTHETIC-PRIVATE-SQL-PATH');
});

it.each(['viewer', 'qa', 'lead', 'admin'] as const)('6B-RBAC: %s has only its established operation privileges', async actor => {
  const a = data.resources.a;
  let response = await dispatch(request(`/api/testcases?projectId=${a.project.id}`, actor), cases.GET);
  expect(response.status).toBe(200);
  const before = await snapshot();
  response = await dispatch(request('/api/bugfix', actor, 'PUT', { id: a.bug.id, status: 'READY TO RETEST' }), bugs.PUT);
  expect(response.status).toBe(actor === 'viewer' ? 403 : 200);
  if (actor === 'viewer') expect(await snapshot()).toEqual(before);
  response = await dispatch(request('/api/testcases', actor, 'PUT', { id: a.tc.id, status: 'DONE' }), cases.PUT);
  expect(response.status).toBe(actor === 'viewer' ? 403 : 200);
  if (actor !== 'viewer') {
    expect((await db.testCase.findUniqueOrThrow({ where: { id: a.tc.id } })).status).toBe('DONE');
    expect((await db.bugFix.findUniqueOrThrow({ where: { id: a.bug.id } })).status).toBe('VERIFIED & FIXED');
  }
  const beforeFinalize = await snapshot();
  response = await dispatch(request(`/api/reports/${a.report.id}/finalize`, actor, 'POST', {}), req => finalizeReport(req, { params: Promise.resolve({ id: a.report.id }) }));
  expect(response.status).toBe(['lead', 'admin'].includes(actor) ? 200 : 403);
  if (!['lead', 'admin'].includes(actor)) expect(await snapshot()).toEqual(beforeFinalize);
  response = await dispatch(request('/api/workspaces/members', actor), () => members.GET());
  expect(response.status).toBe(actor === 'admin' ? 200 : 403);
  response = await dispatch(request('/api/settings/ai', actor, 'PUT', {}), () => settingsPut());
  expect(response.status).toBe(actor === 'admin' ? 405 : 403); // host secret writes disabled, even for admin
  const beforeDelete = await snapshot();
  response = await dispatch(request(`/api/testcases?id=${a.tc.id}`, actor, 'DELETE'), cases.DELETE);
  expect(response.status).toBe(actor === 'viewer' ? 403 : 200); // Existing QA delete policy is preserved.
  if (actor === 'viewer') expect(await snapshot()).toEqual(beforeDelete);
});

it.each(['none', 'foreign', 'multi'] as const)('6B-MEMBERSHIP: %s cannot borrow a stronger role from another workspace', async actor => {
  const a = data.resources.a, b = data.resources.b;
  const target = actor === 'multi' ? b : a;
  const before = await snapshot();
  const response = await dispatch(request('/api/bugfix', actor, 'PUT', { id: target.bug.id, status: 'READY TO RETEST' }, { 'x-qa-role': 'OWNER', 'x-qa-user-id': data.actors.owner.user.id }), bugs.PUT);
  expect(response.status).toBe(403);
  expect(await snapshot()).toEqual(before);
  if (actor === 'multi') {
    const read = await dispatch(request(`/api/testcases?projectId=${b.project.id}`, actor), cases.GET);
    expect(read.status).toBe(200); // VIEWER in B is allowed to read, not write.
  }
});

it.each(['missing', 'invalid', 'expired', 'revoked', 'disabled'])('6B-SESSION: %s session cannot access business records', async kind => {
  const a = data.resources.a;
  const req = request(`/api/testcases?projectId=${a.project.id}`);
  if (kind === 'missing') req.cookies.delete('qa_session');
  if (kind === 'invalid') req.cookies.set('qa_session', 'synthetic-invalid');
  if (kind === 'expired') await db.session.update({ where: { id: data.actors.qa.session.id }, data: { expiresAt: new Date(0) } });
  if (kind === 'revoked') await db.session.delete({ where: { id: data.actors.qa.session.id } });
  if (kind === 'disabled') await db.user.update({ where: { id: data.actors.qa.user.id }, data: { disabledAt: new Date() } });
  const before = await snapshot();
  const response = await dispatch(req, cases.GET);
  expect(response.status).toBe(401);
  expect(await snapshot()).toEqual(before);
});

it('6B-SESSION: an existing session immediately respects role downgrade and membership removal', async () => {
  const membership = await db.workspaceMembership.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId: data.workspaces.a.id, userId: data.actors.qa.user.id } } });
  await db.workspaceMembership.update({ where: { id: membership.id }, data: { role: 'VIEWER' } });
  const before = await snapshot();
  const denied = await dispatch(request('/api/testcases', 'qa', 'PUT', { id: data.resources.a.tc.id, status: 'DONE' }), cases.PUT);
  expect(denied.status).toBe(403);
  await db.workspaceMembership.delete({ where: { id: membership.id } });
  const read = await dispatch(request(`/api/testcases?projectId=${data.resources.a.project.id}`), cases.GET);
  expect(read.status).toBe(403);
  expect(await snapshot()).toEqual(before);
});

it.each(['patch', 'delete-cases', 'delete-bugs'])('6B-BULK: %s rejects the whole mixed-workspace batch', async kind => {
  const a = data.resources.a, b = data.resources.b;
  const before = await snapshot();
  const response = kind === 'patch'
    ? await dispatch(request(`/api/testcases?projectId=${a.project.id}`, 'qa', 'PATCH', { ids: [a.tc.id, a.tc.id, b.tc.id, 'missing'], status: 'DONE' }), cases.PATCH)
    : kind === 'delete-cases'
      ? await dispatch(request(`/api/testcases?projectId=${a.project.id}&ids=${a.tc.id},${b.tc.id}`, 'qa', 'DELETE'), cases.DELETE)
      : await dispatch(request(`/api/bugfix?projectId=${a.project.id}&ids=${a.bug.id},${b.bug.id}`, 'qa', 'DELETE'), bugs.DELETE);
  expect(response.status).toBe(403);
  expect(await snapshot()).toEqual(before);
});

it('6B-BULK: authorized duplicate and missing IDs retain Phase 6A semantics', async () => {
  const a = data.resources.a, a2 = data.resources.a2;
  const response = await dispatch(request('/api/testcases', 'qa', 'PATCH', { ids: [a.tc.id, a.tc.id, a2.tc.id, 'missing'], status: 'DONE' }), cases.PATCH);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ updated: 2 });
  for (const resource of [a, a2]) expect((await db.bugFix.findUniqueOrThrow({ where: { id: resource.bug.id } })).status).toBe('VERIFIED & FIXED');
  expect((await db.testCase.findUniqueOrThrow({ where: { id: data.resources.b.tc.id } })).status).toBe('FAILED');
});

it('6B-NESTED: an authorized run cannot select foreign execution or evidence IDs', async () => {
  const a = data.resources.a, b = data.resources.b;
  const before = await snapshot();
  const response = await dispatch(request(`/api/test-runs/${a.run.id}/executions`, 'qa', 'PUT', { projectId: a.project.id, executionId: b.execution.id, status: 'PASSED' }), req => updateExecution(req, { params: Promise.resolve({ id: a.run.id }) }));
  expect(response.status).toBe(404);
  const list = await dispatch(request(`/api/test-runs/${a.run.id}/executions/${b.execution.id}/evidence?projectId=${a.project.id}`), req => evidenceList(req, { params: Promise.resolve({ id: a.run.id, executionId: b.execution.id }) }));
  expect(list.status).toBe(404);
  const file = await dispatch(request(`/api/test-runs/${a.run.id}/executions/${a.execution.id}/evidence/${b.evidence.id}?projectId=${a.project.id}`), req => evidenceFile(req, { params: Promise.resolve({ id: a.run.id, executionId: a.execution.id, evidenceId: b.evidence.id }) }));
  expect(file.status).toBe(404);
  const ownList = await dispatch(request(`/api/test-runs/${a.run.id}/executions/${a.execution.id}/evidence?projectId=${a.project.id}`), req => evidenceList(req, { params: Promise.resolve({ id: a.run.id, executionId: a.execution.id }) }));
  expect(ownList.status).toBe(200);
  expect(await snapshot()).toEqual(before);
});

it.each(['assignment', 'execution', 'requirement'])('6B-NESTED: %s rejects foreign child IDs without partial effects', async kind => {
  const a = data.resources.a, b = data.resources.b;
  const before = await snapshot();
  const base = kind === 'requirement' ? `/api/requirements/${a.requirement.id}/test-cases` : `/api/test-runs/${a.run.id}/${kind === 'assignment' ? 'cases' : 'executions/bulk'}`;
  const req = request(base, 'qa', 'POST', { projectId: a.project.id, testCaseIds: [a.tc.id, b.tc.id], status: 'PASSED' });
  const response = await dispatch(req, r => kind === 'assignment' ? runCases.POST(r, { params: Promise.resolve({ id: a.run.id }) }) : kind === 'execution' ? bulkExecute(r, { params: Promise.resolve({ id: a.run.id }) }) : linkRequirement(r, { params: Promise.resolve({ id: a.requirement.id }) }));
  expect([400, 404, 500]).toContain(response.status); // Existing service validation errors; no success/partial write.
  expect(await snapshot()).toEqual(before);
});

it('6B-NESTED: own testcase assignment, requirement link and execution remain usable', async () => {
  const a = data.resources.a;
  const assignment = await dispatch(request(`/api/test-runs/${a.run.id}/cases`, 'qa', 'POST', { projectId: a.project.id, testCaseIds: [a.tc.id, a.tc.id] }), req => runCases.POST(req, { params: Promise.resolve({ id: a.run.id }) }));
  expect(assignment.status).toBe(201);
  const link = await dispatch(request(`/api/requirements/${a.requirement.id}/test-cases`, 'qa', 'POST', { projectId: a.project.id, testCaseIds: [a.tc.id] }), req => linkRequirement(req, { params: Promise.resolve({ id: a.requirement.id }) }));
  expect(link.status).toBe(201);
  const execute = await dispatch(request(`/api/test-runs/${a.run.id}/executions/bulk`, 'qa', 'POST', { projectId: a.project.id, testCaseIds: [a.tc.id], status: 'PASSED' }), req => bulkExecute(req, { params: Promise.resolve({ id: a.run.id }) }));
  expect(execute.status).toBe(201);
  expect(await db.testExecution.count({ where: { testRunId: a.run.id, status: 'PASSED' } })).toBe(1);
});

it('6B-READ: foreign direct IDs are denied while same-workspace projects remain accessible', async () => {
  const a = data.resources.a, a2 = data.resources.a2, b = data.resources.b;
  for (const [url, handler] of [
    [`/api/testcases?projectId=${a.project.id}&id=${b.tc.id}`, cases.GET],
    [`/api/reports/${b.report.id}?projectId=${a.project.id}`, (req: NextRequest) => reports.GET(req, { params: Promise.resolve({ id: b.report.id }) })],
    [`/api/evidence?projectId=${b.project.id}&testCaseId=${b.tc.id}`, evidenceHtml],
    [`/api/traceability?projectId=${a.project.id}&testCaseId=${b.tc.id}`, traceability],
  ] as const) {
    const response = await dispatch(request(url), handler);
    expect([403, 404]).toContain(response.status);
    expect(await response.text()).not.toContain('SYNTHETIC-b-PRIVATE-LOG');
  }
  const positive = await dispatch(request(`/api/testcases?projectId=${a2.project.id}`), cases.GET);
  expect(positive.status).toBe(200);
  const history = await dispatch(request(`/api/automation/history?projectId=${a.project.id}`), automationHistory);
  expect(history.status).toBe(200);
  expect(await history.text()).not.toContain(b.tc.id);
});

it('6B-MEMBERS: lower roles cannot escalate; admin cannot grant owner or edit foreign membership', async () => {
  const own = await db.workspaceMembership.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId: data.workspaces.a.id, userId: data.actors.viewer.user.id } } });
  const foreign = await db.workspaceMembership.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId: data.workspaces.b.id, userId: data.actors.foreign.user.id } } });
  const before = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  for (const [actor, target, role, expected] of [['qa', own, 'ADMIN', 403], ['admin', own, 'OWNER', 403], ['admin', foreign, 'QA', 404]] as const) {
    const response = await dispatch(request('/api/workspaces/members', actor, 'PATCH', { membershipId: target.id, role }, { 'x-qa-role': 'OWNER' }), members.PATCH);
    expect(response.status).toBe(expected);
  }
  expect(await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  expect((await dispatch(request('/api/workspaces/members', 'owner', 'PATCH', { membershipId: own.id, role: 'QA' }), members.PATCH)).status).toBe(200);
});

it.each(['origin', 'malformed', 'array', 'multipart-json', 'missing-scope', 'empty-ids'])('6B-GUARD: %s fails without changing business state', async kind => {
  const before = await snapshot();
  const body = kind === 'malformed' ? '{' : kind === 'array' ? [] : { id: data.resources.a.tc.id, ids: kind === 'empty-ids' ? [] : undefined, status: 'DONE' };
  const url = `/api/testcases${kind === 'missing-scope' ? '' : `?projectId=${data.resources.a.project.id}`}`;
  const req = request(url, 'qa', kind === 'empty-ids' ? 'PATCH' : 'PUT', kind === 'missing-scope' ? { status: 'DONE' } : body,
    kind === 'origin' ? { origin: 'https://untrusted.example' } : kind === 'multipart-json' ? { 'Content-Type': 'multipart/form-data; boundary=synthetic' } : {});
  const response = await dispatch(req, kind === 'empty-ids' ? cases.PATCH : cases.PUT);
  expect([400, 403, 415]).toContain(response.status);
  expect(await snapshot()).toEqual(before);
});

it('6B-HEADERS: project listing uses server identity, never client x-qa claims', async () => {
  const req = request('/api/projects', 'qa', 'GET', undefined, { 'x-qa-user-id': data.actors.foreign.user.id, 'x-qa-workspace-id': data.workspaces.b.id, 'x-qa-role': 'OWNER' });
  const response = await dispatch(req, () => projects.GET());
  expect(response.status).toBe(200);
  expect((await response.json()).every((project: { workspaceId: string }) => project.workspaceId === data.workspaces.a.id)).toBe(true);
});
