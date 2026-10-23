import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { seedAuthorizationFixture } from '../../scripts/phase6b-fixture.mjs';

const fixture = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'traceva-members-'));
  return { root, url: `file:${path.join(root, 'synthetic.db').replaceAll('\\', '/')}`, headers: new AsyncLocalStorage<Headers>() };
});
vi.mock('@/lib/db', async () => { const { PrismaClient } = await import('@prisma/client'); return { db: new PrismaClient({ datasourceUrl: fixture.url, log: [] }) }; });
vi.mock('next/headers', () => ({ headers: async () => fixture.headers.getStore() || new Headers() }));

import { db } from '@/lib/db';
import { proxy } from '@/proxy';
import * as members from '@/app/api/workspaces/members/route';
import { createSession, getSessionByToken, verifyPassword } from '@/lib/auth';
import { POST as passwordLogin } from '@/app/api/auth/login/route';

let data: Awaited<ReturnType<typeof seedAuthorizationFixture>>;
type Alias = keyof Awaited<ReturnType<typeof seedAuthorizationFixture>>['actors'];
const request = (actor: Alias, method = 'GET', body?: unknown, suffix = '') => new NextRequest(`http://localhost/api/workspaces/members${suffix}`, {
  method, headers: { origin: 'http://localhost', host: 'localhost', Cookie: `qa_session=${data.actors[actor].token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
async function dispatch(req: NextRequest, handler: (req: NextRequest) => Promise<Response>) {
  const decision = await proxy(req);
  if (decision.headers.get('x-middleware-next') !== '1') return decision;
  const headers = new Headers();
  for (const [name, value] of decision.headers) if (name.startsWith('x-middleware-request-')) headers.set(name.slice(21), value);
  return fixture.headers.run(headers, () => handler(req));
}
async function membership(alias: Alias) {
  return db.workspaceMembership.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId: data.workspaces.a.id, userId: data.actors[alias].user.id } } });
}
async function secondOwner() {
  const response = await dispatch(request('owner', 'POST', { name: 'Second Owner', email: 'second-owner@example.test', password: 'Synthetic-owner-123', role: 'OWNER' }), members.POST);
  expect(response.status).toBe(201);
  const member = (await response.json()).member;
  const session = await createSession(member.user.id);
  return { ...member, session };
}
const patch = (actor: Alias, input: unknown) => dispatch(request(actor, 'PATCH', input), members.PATCH);
const remove = (actor: Alias, id: string) => dispatch(request(actor, 'DELETE', undefined, `?membershipId=${encodeURIComponent(id)}`), members.DELETE);

beforeAll(async () => {
  await fs.writeFile(path.join(fixture.root, 'synthetic.db'), '');
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', path.resolve('prisma/sqlite.prisma'), '--skip-generate'], { env: { ...process.env, DATABASE_URL: fixture.url }, stdio: 'pipe' });
}, 60000);
beforeEach(async () => { await db.workspace.deleteMany(); await db.user.deleteMany(); data = await seedAuthorizationFixture(db); });
afterAll(async () => {
  await db.$disconnect();
  if (!path.resolve(fixture.root).startsWith(path.resolve(process.env.TEMP!) + path.sep) || !path.basename(fixture.root).startsWith('traceva-members-')) throw new Error('Unsafe temporary cleanup');
  await fs.rm(fixture.root, { recursive: true, force: true });
});

it('MEM-EDIT: owner edits second owner identity, optional password, and retains its UUID', async () => {
  const target = await secondOwner();
  const response = await patch('owner', { membershipId: target.id, name: 'Updated Owner', email: ' UPDATED@example.test ', password: 'Changed-password-456', role: 'OWNER' });
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.member.user).toMatchObject({ id: target.user.id, name: 'Updated Owner', email: 'updated@example.test' });
  expect(result.member.role).toBe('OWNER');
  const row = await db.user.findUniqueOrThrow({ where: { id: target.user.id } });
  expect(await verifyPassword('Changed-password-456', row.passwordHash)).toBe(true);
  expect(await getSessionByToken(target.session.token)).toBeNull();
  expect(JSON.stringify(result)).not.toContain(row.passwordHash);
  const history = await db.activityHistory.findMany({ where: { entityId: target.id, action: 'UPDATED' } });
  expect(history.length).toBeGreaterThan(0);
  expect(JSON.stringify(history)).not.toContain('Changed-password-456');
  expect(JSON.stringify(history)).not.toContain(row.passwordHash);
});
it('MEM-EDIT: omitted or empty password retains existing hash and sessions', async () => {
  const target = await membership('qa'); const hash = data.actors.qa.user.passwordHash;
  expect((await patch('owner', { membershipId: target.id, name: 'QA renamed', password: '' })).status).toBe(200);
  expect((await db.user.findUniqueOrThrow({ where: { id: target.userId } })).passwordHash).toBe(hash);
  expect(await getSessionByToken(data.actors.qa.token)).not.toBeNull();
});
it('MEM-DELETE: second owner is removed, its last-workspace account disabled and session revoked', async () => {
  const target = await secondOwner();
  await db.activityHistory.create({ data: { projectId: data.resources.a.project.id, entityType: 'TestCase', entityId: data.resources.a.tc.id, action: 'UPDATED', actorUserId: target.user.id, actor: 'Second Owner' } });
  const result = await remove('owner', target.id);
  expect(result.status).toBe(200); expect(await result.json()).toMatchObject({ deleted: 1, accountDisabled: true });
  expect(await db.workspaceMembership.findUnique({ where: { id: target.id } })).toBeNull();
  expect((await db.user.findUniqueOrThrow({ where: { id: target.user.id } })).disabledAt).not.toBeNull();
  expect(await getSessionByToken(target.session.token)).toBeNull();
  const login = await passwordLogin(new NextRequest('http://localhost/api/auth/login', { method: 'POST', headers: { origin: 'http://localhost', host: 'localhost', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: target.user.email, password: 'Synthetic-owner-123' }) }));
  expect(login.status).toBe(401);
  expect(await db.activityHistory.count({ where: { actorUserId: target.user.id, entityType: 'TestCase' } })).toBe(1);
  expect(await db.testCase.count()).toBe(3);
});
it('MEM-OWNER: final active owner cannot be deleted or demoted, but can edit its name', async () => {
  const target = await membership('owner');
  expect((await remove('owner', target.id)).status).toBe(409);
  expect((await patch('owner', { membershipId: target.id, role: 'QA' })).status).toBe(409);
  expect((await patch('owner', { membershipId: target.id, name: 'Owner renamed' })).status).toBe(200);
  expect((await db.workspaceMembership.findUniqueOrThrow({ where: { id: target.id } })).role).toBe('OWNER');
  expect(await db.session.count({ where: { userId: target.userId } })).toBe(1);
});
it('MEM-OWNER: disabled owner is not counted as the last active owner safeguard', async () => {
  const second = await secondOwner(); await db.user.update({ where: { id: second.user.id }, data: { disabledAt: new Date() } });
  const target = await membership('owner');
  expect((await remove('owner', target.id)).status).toBe(409);
  expect((await patch('owner', { membershipId: target.id, role: 'ADMIN' })).status).toBe(409);
});
it.each(['admin', 'qa', 'viewer'])('MEM-RBAC: %s cannot edit/delete an owner or grant OWNER', async actor => {
  const owner = await membership('owner'), qa = await membership('qa');
  expect((await patch(actor, { membershipId: owner.id, name: 'Hijacked' })).status).toBe(403);
  expect((await remove(actor, owner.id)).status).toBe(403);
  expect((await patch(actor, { membershipId: qa.id, role: 'OWNER' })).status).toBe(403);
  expect((await db.user.findUniqueOrThrow({ where: { id: owner.userId } })).name).toBe(data.actors.owner.user.name);
});
it('MEM-SCOPE: foreign membership cannot be edited or removed', async () => {
  const target = await db.workspaceMembership.findFirstOrThrow({ where: { userId: data.actors.foreign.user.id } });
  expect((await patch('owner', { membershipId: target.id, name: 'Foreign rewrite' })).status).toBe(404);
  expect((await remove('owner', target.id)).status).toBe(404);
  expect(await db.workspaceMembership.findUnique({ where: { id: target.id } })).not.toBeNull();
});
it('MEM-SHARED: local admin cannot take over a shared identity; local role edit/removal keeps other workspace', async () => {
  const target = await membership('multi');
  expect((await patch('owner', { membershipId: target.id, password: 'Hijacked-password-123' })).status).toBe(409);
  expect((await patch('owner', { membershipId: target.id, role: 'QA' })).status).toBe(200);
  const result = await remove('owner', target.id);
  expect(result.status).toBe(200); expect(await result.json()).toMatchObject({ accountDisabled: false });
  expect((await db.user.findUniqueOrThrow({ where: { id: target.userId } })).disabledAt).toBeNull();
  expect(await db.workspaceMembership.count({ where: { userId: target.userId, workspaceId: data.workspaces.b.id } })).toBe(1);
});
it('MEM-VALIDATION: duplicate email rolls back name/role/password and retains session', async () => {
  const target = await membership('qa');
  const response = await patch('owner', { membershipId: target.id, name: 'Should rollback', email: data.actors.owner.user.email, password: 'Changed-password-123', role: 'ADMIN' });
  expect(response.status).toBe(409);
  expect((await db.user.findUniqueOrThrow({ where: { id: target.userId } })).name).toBe(data.actors.qa.user.name);
  expect((await db.workspaceMembership.findUniqueOrThrow({ where: { id: target.id } })).role).toBe('QA');
  expect(await getSessionByToken(data.actors.qa.token)).not.toBeNull();
});
it.each([{ name: '' }, { email: 'invalid' }, { password: 'short' }, { password: 'x'.repeat(201) }, { role: 'SUPERADMIN' }, { name: 7 }])('MEM-VALIDATION: invalid fields %j do not mutate account', async fields => {
  const target = await membership('qa');
  expect((await patch('owner', { membershipId: target.id, ...fields })).status).toBe(400);
  expect((await db.user.findUniqueOrThrow({ where: { id: target.userId } })).name).toBe(data.actors.qa.user.name);
});
it('MEM-VERSION: stale edit rejected without overwriting a newer decision', async () => {
  const target = await membership('qa');
  expect((await patch('owner', { membershipId: target.id, name: 'Newer name' })).status).toBe(200);
  expect((await patch('owner', { membershipId: target.id, name: 'Stale name', expectedUpdatedAt: target.updatedAt.toISOString() })).status).toBe(409);
  expect((await db.user.findUniqueOrThrow({ where: { id: target.userId } })).name).toBe('Newer name');
});
it('MEM-SELF: changing own email invalidates own session and signals login redirect', async () => {
  const target = await membership('owner');
  const response = await patch('owner', { membershipId: target.id, email: 'my-new-email@example.test' });
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ sessionRevoked: true });
  expect(await getSessionByToken(data.actors.owner.token)).toBeNull();
});
it('MEM-ROLLBACK: audit failure rolls back membership deletion, account disable and session removal', async () => {
  const target = await membership('qa');
  await db.$executeRawUnsafe(`CREATE TRIGGER member_audit_failure BEFORE INSERT ON ActivityHistory WHEN NEW.action = 'REMOVED' BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END;`);
  try { expect((await remove('owner', target.id)).status).not.toBe(200); }
  finally { await db.$executeRawUnsafe('DROP TRIGGER member_audit_failure;'); }
  expect(await db.workspaceMembership.findUnique({ where: { id: target.id } })).not.toBeNull();
  expect((await db.user.findUniqueOrThrow({ where: { id: target.userId } })).disabledAt).toBeNull();
  expect(await getSessionByToken(data.actors.qa.token)).not.toBeNull();
});
it('MEM-CONCURRENCY: two simultaneous removals cannot leave zero active owners', async () => {
  const second = await secondOwner(), first = await membership('owner');
  const responses = await Promise.all([remove('owner', first.id), remove('owner', second.id)]);
  expect(responses.filter(r => r.status === 200)).toHaveLength(1);
  expect(responses.filter(r => [403, 409].includes(r.status))).toHaveLength(1);
  expect(await db.workspaceMembership.count({ where: { workspaceId: data.workspaces.a.id, role: 'OWNER', user: { disabledAt: null } } })).toBe(1);
});
it('MEM-LIST: exposes permission reasons and version fields, never hashes or sessions', async () => {
  const response = await dispatch(request('owner'), () => members.GET());
  expect(response.status).toBe(200); const result = await response.json();
  const owner = result.members.find((row: { user: { id: string } }) => row.user.id === data.actors.owner.user.id);
  expect(owner).toMatchObject({ canEdit: true, canRemove: false, protectedOwner: true, isSelf: true });
  expect(JSON.stringify(result)).not.toMatch(/passwordHash|tokenHash/);
});
