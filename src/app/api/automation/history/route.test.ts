import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { caseDirectory, deleteScriptRuns, runDirectory, writeJson } from '@/lib/automation/script-store.mjs';

const mocks = vi.hoisted(() => ({ session: vi.fn(), project: vi.fn(), cases: vi.fn(), bugs: vi.fn(), latest: vi.fn(), counts: vi.fn(), useDevlog: false }));
vi.mock('@/lib/db', () => ({ db: { project: { findUnique: mocks.project }, testCase: { findMany: mocks.cases }, bugFix: { findMany: mocks.bugs } } }));
vi.mock('@/lib/devlog-db', () => ({ get devlogDb() { return mocks.useDevlog ? { automationRun: { findMany: mocks.latest, groupBy: mocks.counts } } : null; } }));
vi.mock('@/lib/auth', () => ({ SESSION_COOKIE: 'qa_session', getSessionByToken: mocks.session, hasMinimumRole: (role: string) => ['OWNER', 'ADMIN'].includes(role) }));
vi.mock('@/lib/services/weight-service', () => ({ getCalculatedWeightMap: async () => new Map(), calculatedWeightFor: () => null }));
import { GET } from './route';

let root: string;
const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const testcase = { id: 'c', projectId: 'p', page: 'Login', testCaseId: 'QA-001', status: 'NOT DONE' };
const request = () => new NextRequest('http://localhost:3000/api/automation/history?projectId=p', { headers: { cookie: 'qa_session=synthetic' } });
async function seed(runId = first, status = 'PASSED', projectId = 'p', testCaseId = 'c', createdAt = '2026-01-02T12:00:00Z') {
  await writeJson(path.join(runDirectory(root, projectId, testCaseId, runId), 'run.json'), {
    runId, projectId, testCaseId, status, createdAt, startedAt: null, endedAt: null,
    artifacts: [{ file: 'private/file.webm', size: 123, kind: 'video' }],
  });
  await writeJson(path.join(caseDirectory(root, projectId, testCaseId), 'history', `${new Date(createdAt).getTime()}-${runId}.json`), { runId });
}
beforeEach(async () => {
  vi.resetAllMocks(); mocks.useDevlog = false;
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'traceva-history-menu-'));
  vi.stubEnv('QA_SCRIPT_RUNNER_DIR', root); vi.stubEnv('QA_RELAY_LOGS_DIR', path.join(root, 'empty-logs'));
  mocks.session.mockResolvedValue({ user: { memberships: [{ workspaceId: 'w', role: 'OWNER' }] } });
  mocks.project.mockResolvedValue({ id: 'p', workspaceId: 'w', deletionState: 'ACTIVE' });
  mocks.cases.mockImplementation(async ({ where }) => where.projectId === 'p' && (!where.id || where.id.in.includes('c')) ? [testcase] : []);
  mocks.bugs.mockResolvedValue([]); mocks.latest.mockResolvedValue([]); mocks.counts.mockResolvedValue([]);
});
afterEach(async () => { vi.unstubAllEnvs(); await fs.rm(root, { recursive: true, force: true }); });

describe('Automation Log includes scoped Studio history', () => {
  it('HISTORY-PAGE: hydrates only the selected page and preserves filters/record indicators', async () => {
    const headers = Array.from({ length: 30 }, (_, i) => ({ ...testcase, id: `case-${i}`, testCaseId: `QA-${i}`, testAction: `Action ${i}`, moduleId: null, module: null }));
    mocks.cases.mockImplementation(async ({ where }) => headers.filter(item => !where.id || where.id.in.includes(item.id)));
    const logs = path.join(root, 'empty-logs'); await fs.mkdir(logs);
    for (const [i, header] of headers.entries()) await fs.writeFile(path.join(logs, `${header.id}.current.jsonl`), JSON.stringify({ source: 'manual-click', timestamp: new Date(Date.UTC(2026, 0, i + 1)).toISOString() }));
    const data = await (await GET(new NextRequest('http://localhost/api/automation/history?projectId=p&limit=5&page=2'))).json();
    expect(data).toMatchObject({ total: 30, totalPages: 6, page: 2 });
    expect(data.items.map((item: { id: string }) => item.id)).toEqual(['case-24', 'case-23', 'case-22', 'case-21', 'case-20']);
    const detailCalls = mocks.cases.mock.calls.filter(([query]) => query.select?.steps);
    expect(detailCalls).toHaveLength(1);
    expect(detailCalls[0][0].where.id.in).toHaveLength(5);
    mocks.cases.mockClear();
    const records = await (await GET(new NextRequest('http://localhost/api/automation/history?projectId=p&view=records'))).json();
    expect(Object.keys(records.records)).toHaveLength(30);
    expect(mocks.cases.mock.calls.some(([query]) => query.select?.steps)).toBe(false);
    const filtered = await (await GET(new NextRequest('http://localhost/api/automation/history?projectId=p&search=Action%200'))).json();
    expect(filtered.items.map((item: { id: string }) => item.id)).toEqual(['case-0']);
  });
  it.each([false, true])('includes historical Studio runs without relay records (devlog=%s)', async devlog => {
    mocks.useDevlog = devlog; await seed();
    const response = await GET(request());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.total).toBe(1);
    expect(data.items[0]).toMatchObject({ id: 'c', status: 'NOT DONE', automation: { hasPlaywrightStudio: true, hasAutomationRun: true, studioRunId: first, studioStatus: 'PASSED', totalBytes: 123 } });
    expect(JSON.stringify(data)).not.toContain('private/file');
  });
  it.each(['QUEUED', 'RUNNING', 'FAILED', 'CANCELLED', 'TIMED_OUT', 'INTERRUPTED', 'RESOURCE_LIMIT'])('includes %s without requiring a video or events file', async status => {
    await seed(first, status);
    const data = await (await GET(request())).json();
    expect(data.items[0].automation.studioStatus).toBe(status);
  });
  it('merges manual + Studio into one testcase row and sorts by latest activity', async () => {
    mocks.useDevlog = true; await seed();
    mocks.latest.mockResolvedValue([{ id: 'relay-run', testCaseId: 'c', mode: 'manual', startedAt: new Date('2026-01-03T00:00:00Z'), endedAt: null, recording: null, _count: { events: 2 } }]);
    mocks.counts.mockResolvedValue([{ testCaseId: 'c', _count: { _all: 1 } }]);
    const data = await (await GET(request())).json();
    expect(data.total).toBe(1);
    expect(data.items[0].automation).toMatchObject({ hasPlaywrightStudio: true, hasManualCapture: true, hasAutomationRun: true, hasPrevious: true, lastRunAt: '2026-01-03T00:00:00.000Z' });
  });
  it('HISTORY-PAGE: defers relay recording/event details and preserves Studio precedence on equal timestamps', async () => {
    mocks.useDevlog = true; await seed();
    mocks.latest.mockResolvedValue([{ id: 'relay-run', testCaseId: 'c', mode: 'manual', startedAt: new Date('2026-01-02T12:00:00Z'), endedAt: null,
      recording: { status: 'ready', metadata: { video: { sizeBytes: 999 } } }, _count: { events: 2 } }]);
    mocks.counts.mockResolvedValue([{ testCaseId: 'c', _count: { _all: 1 } }]);
    const data = await (await GET(request())).json();
    expect(data.items[0].automation).toMatchObject({ totalBytes: 123, eventCount: 2, recordingStatus: 'ready' });
    expect(mocks.latest.mock.calls[0][0].select.recording.select).toEqual({ status: true });
    expect(mocks.latest.mock.calls[0][0].select).not.toHaveProperty('_count');
    expect(mocks.latest.mock.calls[1][0].where).toEqual({ projectId: 'p', id: { in: ['relay-run'] } });
  });
  it('shows the retained older run after deletion and removes the row after all runs are deleted', async () => {
    await seed(); await seed(second, 'FAILED', 'p', 'c', '2026-01-03T00:00:00Z');
    expect((await (await GET(request())).json()).items[0].automation.studioRunId).toBe(second);
    await deleteScriptRuns(root, 'p', 'c', [second]);
    expect((await (await GET(request())).json()).items[0].automation.studioRunId).toBe(first);
    await deleteScriptRuns(root, 'p', 'c', [first]);
    expect((await (await GET(request())).json()).items).toEqual([]);
  });
  it('ignores foreign project/case records including a mismatched local history pointer', async () => {
    await seed(first, 'PASSED', 'other-project'); await seed(second, 'PASSED', 'p', 'foreign-case');
    await seed();
    await writeJson(path.join(runDirectory(root, 'p', 'c', first), 'run.json'), { runId: first, projectId: 'other-project', testCaseId: 'c' });
    expect((await (await GET(request())).json()).items).toEqual([]);
  });
  it.each(['QA', 'VIEWER', 'QA_LEAD'])('does not expose Studio metadata to %s', async role => {
    await seed(); mocks.session.mockResolvedValue({ user: { memberships: [{ workspaceId: 'w', role }] } });
    expect((await (await GET(request())).json()).items).toEqual([]);
  });
  it('rejects unauthenticated, guest and foreign-workspace access before filesystem lookup', async () => {
    for (const [session, status] of [[null, 401], [{ guest: {}, user: {} }, 403], [{ user: { memberships: [{ workspaceId: 'other', role: 'OWNER' }] } }, 403]] as const) {
      mocks.session.mockResolvedValue(session);
      expect((await GET(request())).status).toBe(status);
    }
    expect(mocks.cases).not.toHaveBeenCalled();
  });
});
