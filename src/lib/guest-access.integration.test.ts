import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { seedAuthorizationFixture } from '../../scripts/phase6b-fixture.mjs';

const fixture = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'traceva-guest-'));
  process.env.QA_EVIDENCE_STORAGE_DIR = path.join(root, 'evidence');
  return { root, url: `file:${path.join(root, 'synthetic.db').replaceAll('\\', '/')}`, headers: new AsyncLocalStorage<Headers>() };
});
vi.mock('@/lib/db', async () => { const { PrismaClient } = await import('@prisma/client'); return { db: new PrismaClient({ datasourceUrl: fixture.url, log: [] }) }; });
vi.mock('next/headers', () => ({ headers: async () => fixture.headers.getStore() || new Headers() }));

import { db } from '@/lib/db';
import { proxy } from '@/proxy';
import { createGuestAccess, listGuestAccess, redeemGuestAccess, revokeGuestAccess } from '@/lib/services/guest-access-service';
import { getSessionByToken, hashSessionToken } from '@/lib/auth';
import { GUEST_PRESETS } from '@/lib/domain/guest-access';
import * as admin from '@/app/api/workspaces/guest-access/route';
import * as projects from '@/app/api/projects/route';
import * as cases from '@/app/api/testcases/route';
import * as run from '@/app/api/test-runs/[id]/route';
import * as executions from '@/app/api/test-runs/[id]/executions/route';
import * as evidence from '@/app/api/test-runs/[id]/executions/[executionId]/evidence/route';
import { POST as createBug } from '@/app/api/test-runs/[id]/executions/[executionId]/bug/route';
import { GET as traceability } from '@/app/api/traceability/route';
import { POST as guestLogin } from '@/app/api/auth/guest/route';
import { POST as passwordLogin } from '@/app/api/auth/login/route';

let data: Awaited<ReturnType<typeof seedAuthorizationFixture>>;
const req = (url: string, token: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) => new NextRequest(`http://localhost${url}`, { method, headers: { origin: 'http://localhost', host: 'localhost', Cookie: `qa_session=${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
async function dispatch(request: NextRequest, handler: (request: NextRequest) => Promise<Response>) {
  const decision = await proxy(request);
  if (decision.headers.get('x-middleware-next') !== '1') return decision;
  const headers = new Headers();
  for (const [name, value] of decision.headers) if (name.startsWith('x-middleware-request-')) headers.set(name.slice(21), value);
  return fixture.headers.run(headers, () => handler(request));
}
function input(preset: 'REVIEWER' | 'TESTER' = 'REVIEWER') { return { workspaceId: data.workspaces.a.id, label: 'Synthetic client', preset, projectIds: [data.resources.a.project.id], permissions: [...GUEST_PRESETS[preset]], expiresInHours: 24, maxUses: 1 }; }
async function issued(preset: 'REVIEWER' | 'TESTER' = 'REVIEWER') { const created = await createGuestAccess(data.actors.admin.user.id, input(preset)); return { ...created, session: await redeemGuestAccess(created.token) }; }

beforeAll(async () => {
  await fs.writeFile(path.join(fixture.root, 'synthetic.db'), '');
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', path.resolve('prisma/sqlite.prisma'), '--skip-generate'], { env: { ...process.env, DATABASE_URL: fixture.url }, stdio: 'pipe' });
}, 60000);
beforeEach(async () => { vi.restoreAllMocks(); await db.workspace.deleteMany(); await db.user.deleteMany(); data = await seedAuthorizationFixture(db); });
afterAll(async () => { await db.$disconnect(); if (!path.resolve(fixture.root).startsWith(path.resolve(process.env.TEMP!) + path.sep) || !path.basename(fixture.root).startsWith('traceva-guest-')) throw new Error('Unsafe temporary cleanup'); await fs.rm(fixture.root, { recursive: true, force: true }); });

it('GUEST-ISSUE: stores only a hash, creates a non-member identity, and never lists the secret', async () => {
  const created = await createGuestAccess(data.actors.owner.user.id, input());
  expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const row = await db.guestAccessGrant.findUniqueOrThrow({ where: { id: created.grant.id }, include: { guestUser: true } });
  expect(row.tokenHash).toBe(hashSessionToken(created.token)); expect(row.tokenHash).not.toBe(created.token);
  expect(row.guestUser.isGuest).toBe(true); expect(row.guestUser.passwordHash).toBe('!');
  expect(await db.workspaceMembership.count({ where: { userId: row.guestUserId } })).toBe(0);
  const list = JSON.stringify(await listGuestAccess(data.actors.admin.user.id, data.workspaces.a.id));
  expect(list).not.toContain(created.token); expect(list).not.toContain('tokenHash');
  expect(await db.activityHistory.count({ where: { entityId: row.id, action: 'CREATED', actorUserId: data.actors.owner.user.id } })).toBe(1);
});
it.each(['qa', 'viewer', 'foreign'])('GUEST-ADMIN: %s cannot issue grants in this workspace', async alias => {
  await expect(createGuestAccess(data.actors[alias].user.id, input())).rejects.toMatchObject({ status: 403 });
  expect(await db.guestAccessGrant.count()).toBe(0);
});
it.each([{ permissions: [] }, { permissions: ['admin.all'] }, { permissions: ['evidence.upload', 'cases.view'] }, { projectIds: [] }, { expiresInHours: 0 }, { maxUses: 101 }])('GUEST-VALIDATION: rejects unsafe input %j without creating an identity', async override => {
  const before = await db.user.count();
  await expect(createGuestAccess(data.actors.admin.user.id, { ...input(), ...override })).rejects.toMatchObject({ status: 400 });
  expect(await db.user.count()).toBe(before);
});
it('GUEST-SCOPE: rejects a foreign project even when mixed with an allowed one', async () => {
  await expect(createGuestAccess(data.actors.admin.user.id, { ...input(), projectIds: [data.resources.a.project.id, data.resources.b.project.id] })).rejects.toMatchObject({ status: 403 });
  expect(await db.guestAccessGrant.count()).toBe(0);
});
it('GUEST-REDEEM: returns an HttpOnly session, bounded by grant expiry, and rejects reuse', async () => {
  const created = await createGuestAccess(data.actors.admin.user.id, input());
  const response = await guestLogin(req('/api/auth/guest', '', 'POST', { token: created.token }, { 'x-forwarded-for': crypto.randomUUID() }));
  expect(response.status).toBe(200); expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i); expect(response.headers.get('cache-control')).toBe('no-store');
  const session = await db.session.findFirstOrThrow({ where: { user: { isGuest: true } } });
  expect(session.expiresAt.getTime()).toBe(created.grant.expiresAt.getTime());
  await expect(redeemGuestAccess(created.token)).rejects.toMatchObject({ status: 401 });
  expect(await db.activityHistory.count({ where: { entityId: created.grant.id, action: 'REDEEMED' } })).toBe(1);
});
it('GUEST-RACE: concurrent redemption consumes exactly one slot and one session', async () => {
  const created = await createGuestAccess(data.actors.admin.user.id, input());
  const results = await Promise.allSettled([redeemGuestAccess(created.token), redeemGuestAccess(created.token)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await db.guestAccessGrant.findUniqueOrThrow({ where: { id: created.grant.id } })).usedCount).toBe(1);
  expect(await db.session.count({ where: { user: { isGuest: true } } })).toBe(1);
});
it('GUEST-ROLLBACK: a failed audit rolls back both session and redemption slot', async () => {
  const created = await createGuestAccess(data.actors.admin.user.id, input());
  await db.$executeRawUnsafe(`CREATE TRIGGER guest_test_audit_failure BEFORE INSERT ON ActivityHistory WHEN NEW.action = 'REDEEMED' BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END;`);
  await expect(redeemGuestAccess(created.token)).rejects.toBeDefined();
  await db.$executeRawUnsafe('DROP TRIGGER guest_test_audit_failure;');
  expect((await db.guestAccessGrant.findUniqueOrThrow({ where: { id: created.grant.id } })).usedCount).toBe(0);
  expect(await db.session.count({ where: { user: { isGuest: true } } })).toBe(0);
});
it.each(['expired', 'revoked', 'project-deleted', 'workspace-moved'])('GUEST-LIFETIME: %s invalidates an existing session', async kind => {
  const guest = await issued();
  if (kind === 'expired') await db.guestAccessGrant.update({ where: { id: guest.grant.id }, data: { expiresAt: new Date(0) } });
  if (kind === 'revoked') await revokeGuestAccess(data.actors.admin.user.id, data.workspaces.a.id, guest.grant.id);
  if (kind === 'project-deleted') await db.project.update({ where: { id: data.resources.a.project.id }, data: { deletionState: 'DELETING' } });
  if (kind === 'workspace-moved') await db.project.update({ where: { id: data.resources.a.project.id }, data: { workspaceId: data.workspaces.b.id } });
  expect(await getSessionByToken(guest.session.token)).toBeNull();
  expect((await proxy(req('/api/projects', guest.session.token))).status).toBe(401);
});
it('GUEST-REVIEWER: reads only granted projects and rejects writes, raw logs, exports, admin, and forged privileges', async () => {
  const guest = await issued(); const a = data.resources.a;
  const list = await dispatch(req('/api/projects', guest.session.token), () => projects.GET());
  expect((await list.json()).map((p: { id: string }) => p.id)).toEqual([a.project.id]);
  expect((await dispatch(req(`/api/testcases?projectId=${a.project.id}`, guest.session.token), cases.GET)).status).toBe(200);
  const count = await db.testCase.count();
  for (const [endpoint, method, body] of [
    [`/api/testcases?projectId=${a.project.id}`, 'POST', { projectId: a.project.id, testCaseId: 'DENIED' }],
    [`/api/testcases?projectId=${data.resources.a2.project.id}`, 'GET'],
    [`/api/testcases?projectId=${data.resources.b.project.id}`, 'GET'],
    [`/api/excel?projectId=${a.project.id}`, 'GET'], [`/api/evidence?projectId=${a.project.id}&testCaseId=${a.tc.id}`, 'GET'],
    [`/api/automation/history?projectId=${a.project.id}`, 'GET'], ['/api/relay/logs', 'GET'], ['/api/settings/ai', 'GET'],
    [`/api/workspaces/guest-access?workspaceId=${data.workspaces.a.id}`, 'GET'],
  ] as Array<[string, string, unknown?]>) {
    const response = await proxy(req(endpoint, guest.session.token, method, body, { 'x-qa-role': 'OWNER', 'x-qa-guest-access': '', 'x-qa-user-id': data.actors.owner.user.id }));
    expect(response.status, endpoint).toBe(403);
  }
  expect(await db.testCase.count()).toBe(count);
});
it('GUEST-TESTER: can execute with real guest actor; upload/create bug is limited to own execution', async () => {
  const guest = await issued('TESTER'); const a = data.resources.a;
  await db.testRunCase.create({ data: { testRunId: a.run.id, testCaseId: a.tc.id } });
  const response = await dispatch(req(`/api/test-runs/${a.run.id}/executions`, guest.session.token, 'POST', { projectId: a.project.id, testCaseId: a.tc.id, status: 'FAILED', tester: 'FORGED OWNER' }), r => executions.POST(r, { params: Promise.resolve({ id: a.run.id }) }));
  expect(response.status).toBe(201); const execution = await response.json();
  expect(execution.tester).toMatch(/^Guest: Synthetic client/);
  expect(await db.activityHistory.findFirst({ where: { entityId: execution.id, action: 'CREATED' } })).toMatchObject({ actorUserId: (await getSessionByToken(guest.session.token))!.user.id });
  const bugResponse = await dispatch(req(`/api/test-runs/${a.run.id}/executions/${execution.id}/bug?projectId=${a.project.id}`, guest.session.token, 'POST', {}), r => createBug(r, { params: Promise.resolve({ id: a.run.id, executionId: execution.id }) }));
  expect([200, 201]).toContain(bugResponse.status);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  const form = new FormData(); form.set('file', new File([png], 'synthetic.png', { type: 'image/png' }));
  const upload = new NextRequest(`http://localhost/api/test-runs/${a.run.id}/executions/${execution.id}/evidence?projectId=${a.project.id}`, { method: 'POST', headers: { origin: 'http://localhost', host: 'localhost', Cookie: `qa_session=${guest.session.token}` }, body: form });
  expect((await dispatch(upload, r => evidence.POST(r, { params: Promise.resolve({ id: a.run.id, executionId: execution.id }) }))).status).toBe(201);
  expect(await db.testExecutionEvidence.count({ where: { executionId: execution.id } })).toBe(1);
  const own = await proxy(req(`/api/test-runs/${a.run.id}/executions/${a.execution.id}/bug?projectId=${a.project.id}`, guest.session.token, 'POST', {}));
  expect(own.status).toBe(403);
  const edit = await proxy(req(`/api/test-runs/${a.run.id}/executions`, guest.session.token, 'PUT', { projectId: a.project.id, executionId: execution.id, status: 'PASSED' }));
  expect(edit.status).toBe(403);
});
it('GUEST-PROJECTION: run/traceability cannot leak raw capture logs or storage paths', async () => {
  const guest = await issued(); const a = data.resources.a;
  await db.testCase.update({ where: { id: a.tc.id }, data: { stepLogs: 'PRIVATE_CAPTURE_TOKEN' } });
  const membership = await db.testRunCase.create({ data: { testRunId: a.run.id, testCaseId: a.tc.id } });
  await db.testExecution.update({ where: { id: a.execution.id }, data: { testRunCaseId: membership.id } });
  const detail = await dispatch(req(`/api/test-runs/${a.run.id}?projectId=${a.project.id}`, guest.session.token), r => run.GET(r, { params: Promise.resolve({ id: a.run.id }) }));
  expect(detail.status).toBe(200); expect(await detail.text()).not.toContain('PRIVATE_CAPTURE_TOKEN');
  const relations = await dispatch(req(`/api/traceability?projectId=${a.project.id}&testCaseId=${a.tc.id}`, guest.session.token), traceability);
  const text = await relations.text(); expect(text).not.toContain('storagePath'); expect(text).toContain('"evidence":[]');
});
it('GUEST-LOGIN: origin and body limits apply and a technical identity cannot password-login', async () => {
  const guest = await issued(); const session = await getSessionByToken(guest.session.token);
  const denied = await guestLogin(req('/api/auth/guest', '', 'POST', { token: guest.token }, { origin: 'https://foreign.invalid', 'x-forwarded-for': crypto.randomUUID() }));
  expect(denied.status).toBe(403);
  const large = await guestLogin(req('/api/auth/guest', '', 'POST', { token: 'x'.repeat(3000) }, { 'x-forwarded-for': crypto.randomUUID() })); expect(large.status).toBe(413);
  const password = await passwordLogin(req('/api/auth/login', '', 'POST', { email: session!.user.email, password: data.password })); expect(password.status).toBe(401);
  expect((await dispatch(req('/api/workspaces/guest-access', data.actors.qa.token, 'POST', input()), admin.POST)).status).toBe(403);
});

it('GUEST-MIGRATION: additive SQLite migration preserves legacy records, backs up, and is idempotent', async () => {
  const before = await db.testCase.findMany({ orderBy: { id: 'asc' } });
  const userIds = (await db.user.findMany({ select: { id: true }, orderBy: { id: 'asc' } })).map(row => row.id);
  await db.$executeRawUnsafe('DROP TABLE "GuestAccessProject"');
  await db.$executeRawUnsafe('DROP TABLE "GuestAccessGrant"');
  await db.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN "isGuest"');
  const env = { ...process.env, DATABASE_URL: fixture.url, QA_BACKUP_DIR: path.join(fixture.root, 'backups') };
  try {
    for (let index = 0; index < 2; index++) execFileSync(process.execPath, [path.resolve('scripts/migrate-guest-access-sqlite.mjs'), '--apply'], { cwd: process.cwd(), env, stdio: 'pipe' });
    expect(await db.testCase.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    expect((await db.user.findMany({ orderBy: { id: 'asc' } })).map(row => row.id)).toEqual(userIds);
    expect((await db.user.findMany()).every(user => user.isGuest === false)).toBe(true);
    expect(await db.guestAccessGrant.count()).toBe(0);
    expect((await fs.readdir(path.join(fixture.root, 'backups'))).filter(name => name.endsWith('.sqlite'))).toHaveLength(2);
    expect(await db.$queryRawUnsafe('PRAGMA foreign_key_check')).toEqual([]);
  } finally {
    const columns = await db.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("User")');
    if (!columns.some(column => column.name === 'isGuest')) await db.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false');
  }
});
