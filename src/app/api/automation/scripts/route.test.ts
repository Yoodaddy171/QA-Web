import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { caseDirectory, runDirectory, writeJson } from '@/lib/automation/script-store.mjs';
const mocks = vi.hoisted(() => ({ session: vi.fn(), origin: vi.fn(), project: vi.fn(), testCase: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { project: { findFirst: mocks.project }, testCase: { findFirst: mocks.testCase } } }));
vi.mock('@/lib/auth', () => ({ SESSION_COOKIE: 'qa_session', getSessionByToken: mocks.session, isAllowedRequestOrigin: mocks.origin, hasMinimumRole: (role: string) => role === 'ADMIN' || role === 'OWNER' }));
import { GET, PUT, POST, DELETE } from './route';
let root: string;
let previous: string | undefined;
beforeEach(async () => {
  vi.clearAllMocks();
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'traceva-script-api-'));
  previous = process.env.QA_SCRIPT_RUNNER_DIR; process.env.QA_SCRIPT_RUNNER_DIR = root;
  mocks.session.mockResolvedValue({ guest: null, user: { isGuest: false, name: 'Synthetic owner', memberships: [{ workspaceId: 'w', role: 'OWNER' }] } });
  mocks.origin.mockReturnValue(true); mocks.project.mockResolvedValue({ workspaceId: 'w' }); mocks.testCase.mockResolvedValue({ id: 'c' });
});
afterEach(async () => { if (previous === undefined) delete process.env.QA_SCRIPT_RUNNER_DIR; else process.env.QA_SCRIPT_RUNNER_DIR = previous; await fs.rm(root, { recursive: true, force: true }); });
const request = (method = 'GET', extra = '', body?: unknown, headers?: Record<string, string>) => new NextRequest(`http://localhost:3000/api/automation/scripts?projectId=p&testCaseId=c${extra}`, { method, headers: { cookie: 'qa_session=synthetic', 'content-type': 'application/json', origin: 'http://localhost:3000', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
describe('script execution access boundaries', () => {
  it('requires authentication for script and artifact reads', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request('GET', '&runId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa&artifact=x'))).status).toBe(401);
  });
  it.each(['VIEWER', 'QA', 'QA_LEAD'])('denies %s even on reads', async role => {
    mocks.session.mockResolvedValue({ user: { memberships: [{ workspaceId: 'w', role }] } });
    expect((await GET(request())).status).toBe(403);
  });
  it('denies guests including spoofed admin memberships', async () => {
    mocks.session.mockResolvedValue({ guest: {}, user: { isGuest: true, memberships: [{ workspaceId: 'w', role: 'OWNER' }] } });
    expect((await POST(request('POST', '', { script: 'x' }))).status).toBe(403);
  });
  it('does not borrow privileges from another workspace or testcase', async () => {
    mocks.project.mockResolvedValue({ workspaceId: 'other' });
    expect((await GET(request())).status).toBe(403);
    mocks.project.mockResolvedValue({ workspaceId: 'w' }); mocks.testCase.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(404);
    expect(mocks.testCase).toHaveBeenCalledWith({ where: { id: 'c', projectId: 'p' }, select: { id: true } });
  });
  it('rejects cross-origin mutations and run path traversal', async () => {
    mocks.origin.mockReturnValue(false);
    expect((await PUT(request('PUT', '', { script: 'x' }))).status).toBe(403);
    expect((await GET(request('GET', '&runId=..%2Fsecret'))).status).toBe(400);
  });
  it('saves scripts, reads them back and refuses queuing when runner is offline', async () => {
    const input = { script: "import { test } from '@playwright/test';", timeoutSeconds: 60, baseURL: '' };
    expect((await PUT(request('PUT', '', input))).status).toBe(200);
    expect((await (await GET(request())).json()).script.script).toBe(input.script);
    expect((await POST(request('POST', '', input))).status).toBe(409);
    expect((await fs.readdir(caseDirectory(root, 'p', 'c')))).toEqual(['script.json']);
  });
  it('serves only manifest artifacts with range support and no filesystem paths in JSON', async () => {
    const runId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const directory = runDirectory(root, 'p', 'c', runId);
    await fs.mkdir(path.join(directory, 'artifacts'), { recursive: true });
    await fs.writeFile(path.join(directory, 'artifacts/video.webm'), '0123456789');
    await writeJson(path.join(directory, 'run.json'), { runId, projectId: 'p', testCaseId: 'c', status: 'PASSED', artifacts: [{ id: 'v', file: 'video.webm', name: 'video.webm', kind: 'video' }] });
    const response = await GET(request('GET', `&runId=${runId}&artifact=v`, undefined, { range: 'bytes=2-5' }));
    expect(response.status).toBe(206); expect(await response.text()).toBe('2345');
    expect(response.headers.get('content-range')).toBe('bytes 2-5/10');
    const detail = await (await GET(request('GET', `&runId=${runId}`))).json();
    expect(detail.run.artifacts[0].file).toBeUndefined();
    expect((await GET(request('GET', `&runId=${runId}&artifact=unknown`))).status).toBe(404);
    expect((await GET(request('GET', `&runId=${runId}&artifact=v`, undefined, { range: 'bytes=200-300' }))).status).toBe(416);
    expect((await DELETE(request('DELETE', '&runId=bad', {}))).status).toBe(400);
  });
});
