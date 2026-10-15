import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { BugFix, TestCase } from '@prisma/client';

// This suite never uses DATABASE_URL from the developer's environment.
const fixture = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qadesk-phase6a-'));
  return { root, url: `file:${path.join(root, 'synthetic.db').replaceAll('\\', '/')}` };
});
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('@prisma/client');
  return { db: new PrismaClient({ datasourceUrl: fixture.url, log: [] }) };
});

import { db } from '@/lib/db';
import { GET as listBugs, PUT as putBug } from '@/app/api/bugfix/route';
import { GET as listCases, PUT as putCase, PATCH as patchCases } from '@/app/api/testcases/route';
import { BUGFIX_STATUS as B } from '@/lib/domain/bugfix';
import { TESTCASE_STATUS as T, TESTCASE_ACTUAL_RESULT as A } from '@/lib/domain/testcase';
import { proxy } from '@/proxy';
import { createSession, SESSION_COOKIE } from '@/lib/auth';

const request = (endpoint: string, method: string, body: unknown) => new NextRequest(`http://localhost/api/${endpoint}`, {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const changeBug = (id: string, status: string) => putBug(request('bugfix', 'PUT', { id, status }));
const changeCase = (id: string, status: string) => putCase(request('testcases', 'PUT', { id, status }));
const bulk = (ids: string[], status: string) => patchCases(request('testcases', 'PATCH', { ids, status }));
const oldTime = new Date('2020-01-01T00:00:00.000Z');
// The test barriers wrap awaited reads, not Prisma's unused fluent relation API.
type AwaitedReader<T> = { findUnique: (args: any) => Promise<T | null> };
const bugReader = () => db.bugFix as unknown as AwaitedReader<BugFix>;
const caseReader = () => db.testCase as unknown as AwaitedReader<TestCase>;

async function pair(id = 'a', status: string = B.FIXING, projectId = 'p') {
  const tc = await db.testCase.create({ data: {
    id: `tc-${id}`, projectId, testCaseId: `TC-${id}`, page: 'Checkout', testType: 'Positive',
    testAction: 'Pay', steps: 'Submit', expectedResult: 'Paid', priority: 'High',
    status: status === B.READY_TO_RETEST ? T.READY_TO_RETEST : T.FAILED,
    actualResult: A.NOT_AS_EXPECTED, createdAt: oldTime, updatedAt: oldTime,
  } });
  const bug = await db.bugFix.create({ data: {
    id: `bug-${id}`, sourceTestCaseId: tc.id, projectId, testCaseId: tc.testCaseId,
    page: tc.page, testType: tc.testType, testAction: tc.testAction, steps: tc.steps,
    expectedResult: tc.expectedResult, actualResult: A.NOT_AS_EXPECTED, priority: tc.priority,
    status, reportedAt: oldTime, fixingAt: status === B.REPORTED ? null : oldTime,
    readyAt: status === B.READY_TO_RETEST ? oldTime : null, createdAt: oldTime, updatedAt: oldTime,
  } });
  return { tc, bug };
}

async function state(id = 'a') {
  return {
    bug: await db.bugFix.findUniqueOrThrow({ where: { id: `bug-${id}` } }),
    tc: await db.testCase.findUniqueOrThrow({ where: { id: `tc-${id}` } }),
    history: await db.activityHistory.findMany({ orderBy: { id: 'asc' } }),
  };
}

// Gate after both real database reads, before either request can mutate. No sleeps.
function synchronizeBugReads() {
  const original = db.bugFix.findUnique.bind(db.bugFix);
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  return vi.spyOn(bugReader(), 'findUnique').mockImplementation(async args => {
    const row = await original(args);
    if (++arrived === 2) release();
    await gate;
    return row;
  });
}

describe('Phase 6A synthetic SQLite data integrity', () => {
  beforeAll(async () => {
    await fs.writeFile(path.join(fixture.root, 'synthetic.db'), '');
    execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push',
      '--schema', path.resolve('prisma/sqlite.prisma'), '--skip-generate'], {
      env: { ...process.env, DATABASE_URL: fixture.url }, stdio: 'pipe',
    });
  }, 60_000);
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_bug');
    await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_case');
    await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_history');
    await db.workspace.deleteMany();
    await db.workspace.create({ data: { id: 'w', name: 'Synthetic', slug: 'synthetic' } });
    await db.project.createMany({ data: [{ id: 'p', workspaceId: 'w', name: 'One' }, { id: 'q', workspaceId: 'w', name: 'Two' }] });
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await db.$disconnect();
    await fs.rm(fixture.root, { recursive: true, force: true });
  });

  it('6A-ATOMIC: rolls back testcase synchronization when the Bug write fails', async () => {
    await pair();
    const before = await state();
    await db.$executeRawUnsafe("CREATE TRIGGER fail_bug BEFORE UPDATE ON BugFix BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
    const response = await changeBug('bug-a', B.READY_TO_RETEST);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to update bug fix item' });
    expect(await state()).toEqual(before);
  });

  it('6A-RETRY: same-state retry preserves lifecycle timestamps and produces no new history', async () => {
    await pair('a', B.REPORTED);
    expect((await changeBug('bug-a', B.FIXING)).status).toBe(200);
    const before = await state();
    expect((await changeBug('bug-a', B.FIXING)).status).toBe(200);
    expect(await state()).toEqual(before);
  });

  it('6A-RETEST: failed testcase retest bounces its ready Bug back to fixing', async () => {
    await pair('a', B.READY_TO_RETEST);
    expect((await changeCase('tc-a', T.FAILED)).status).toBe(200);
    const result = await state();
    expect(result.tc.status).toBe(T.FAILED);
    expect(result.bug.status).toBe(B.FIXING);
    expect(result.bug.fixingAt!.getTime()).toBeGreaterThan(oldTime.getTime());
    expect(result.bug.readyAt).toEqual(oldTime);
    expect(result.bug.fixedAt).toBeNull();
  });

  it('6A-PAGE: equal-timestamp Bugs use a unique secondary ordering key', async () => {
    for (const id of ['c', 'a', 'b', 'd']) await pair(id);
    const spy = vi.spyOn(db.bugFix, 'findMany');
    for (const direction of ['asc', 'desc']) {
      const expected = ['bug-a', 'bug-b', 'bug-c', 'bug-d'];
      if (direction === 'desc') expected.reverse();
      const read = async (page: number) => {
        const res = await listBugs(new NextRequest(`http://localhost/api/bugfix?projectId=p&sortOrder=${direction}&limit=2&page=${page}`));
        expect(res.status).toBe(200);
        return (await res.json()).bugFixItems.map((row: { id: string }) => row.id);
      };
      expect([...(await read(1)), ...(await read(2))]).toEqual(expected);
      expect(await read(1)).toEqual(expected.slice(0, 2));
      expect(spy.mock.lastCall![0]!.orderBy).toEqual([{ createdAt: direction }, { id: direction }]);
    }
  });

  it('6A-ATOMIC: successful READY, bounce and retest preserve lifecycle semantics', async () => {
    await pair();
    expect((await changeBug('bug-a', B.READY_TO_RETEST)).status).toBe(200);
    let result = await state();
    expect(result.bug.status).toBe(B.READY_TO_RETEST);
    expect(result.tc.status).toBe(T.READY_TO_RETEST);
    expect(result.bug.readyAt!.getTime()).toBeGreaterThan(oldTime.getTime());
    expect(result.bug.reportedAt).toEqual(oldTime);
    expect(result.bug.fixingAt).toEqual(oldTime);
    expect(result.bug.fixedAt).toBeNull();
    expect(result.history.filter(h => h.field === 'status')).toHaveLength(2);
    const readyAt = result.bug.readyAt;
    expect((await changeBug('bug-a', B.FIXING)).status).toBe(200);
    result = await state();
    expect(result.tc.status).toBe(T.FAILED);
    expect(result.bug.status).toBe(B.FIXING);
    expect(result.bug.readyAt).toEqual(readyAt);
    expect(result.bug.fixingAt!.getTime()).toBeGreaterThan(oldTime.getTime());
    expect((await changeBug('bug-a', B.READY_TO_RETEST)).status).toBe(200);
    expect((await changeCase('tc-a', T.DONE)).status).toBe(200);
    result = await state();
    expect(result.tc.status).toBe(T.DONE);
    expect(result.tc.actualResult).toBe(A.AS_EXPECTED);
    expect(result.bug.status).toBe(B.VERIFIED_FIXED);
    expect(result.bug.fixedAt).not.toBeNull();
    // A genuine regression reopens the resolved Bug and clears later stages.
    const res = await putCase(request('testcases', 'PUT', { id: 'tc-a', status: T.FAILED, actualResult: A.NOT_AS_EXPECTED }));
    expect(res.status).toBe(200);
    result = await state();
    expect(result.tc.status).toBe(T.FAILED);
    expect(result.bug.status).toBe(B.REPORTED);
    expect(result.bug.fixingAt).toBeNull();
    expect(result.bug.readyAt).toBeNull();
    expect(result.bug.fixedAt).toBeNull();
    expect(await db.bugFix.count()).toBe(1);
  });

  it.each(['case', 'history'])('6A-ATOMIC: %s failure rolls back both records and all history', async kind => {
    await pair();
    const before = await state();
    await db.$executeRawUnsafe(kind === 'case'
      ? "CREATE TRIGGER fail_case BEFORE UPDATE ON TestCase BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END"
      : "CREATE TRIGGER fail_history BEFORE INSERT ON ActivityHistory BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
    expect((await changeBug('bug-a', B.READY_TO_RETEST)).status).toBe(500);
    expect(await state()).toEqual(before);
  });

  it.each([[B.REPORTED, B.FIXING, B.FIXING], [B.FIXING, B.REPORTED, B.READY_TO_RETEST]])(
    '6A-RACE: from %s concurrent %s / %s has exactly one committed change', async (initial, a, b) => {
      await pair('a', initial);
      const reads = synchronizeBugReads();
      const responses = await Promise.all([changeBug('bug-a', a), changeBug('bug-a', b)]);
      reads.mockRestore();
      expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
      const winning = await responses.find(r => r.status === 200)!.json();
      const result = await state();
      expect(result.bug.status).toBe(winning.status);
      expect(result.bug.reportedAt).toEqual(oldTime);
      expect(result.bug.fixedAt).toBeNull();
      if (winning.status === B.READY_TO_RETEST) {
        expect(result.tc.status).toBe(T.READY_TO_RETEST);
        expect(result.bug.readyAt).not.toBeNull();
        expect(result.bug.fixingAt).toEqual(oldTime);
      } else {
        expect(result.tc.status).toBe(T.FAILED);
        expect(result.bug.readyAt).toBeNull();
        if (winning.status === B.FIXING) expect(result.bug.fixingAt!.getTime()).toBeGreaterThan(oldTime.getTime());
        else expect(result.bug.fixingAt).toEqual(oldTime);
      }
      expect(result.history.filter(h => h.entityType === 'BugFix' && h.field === 'status')).toHaveLength(1);
      const beforeRetry = await state();
      expect((await changeBug('bug-a', winning.status)).status).toBe(200);
      expect(await state()).toEqual(beforeRetry);
    },
  );

  it('6A-STALE: a paused request cannot overwrite a committed newer transition', async () => {
    await pair('a', B.REPORTED);
    const original = db.bugFix.findUnique.bind(db.bugFix);
    let release!: () => void;
    let observed!: () => void;
    const seen = new Promise<void>(resolve => { observed = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const spy = vi.spyOn(bugReader(), 'findUnique').mockImplementationOnce(async args => {
      const row = await original(args); observed(); await gate; return row;
    });
    const delayed = changeBug('bug-a', B.FIXING);
    await seen;
    try {
      expect((await changeBug('bug-a', B.FIXING)).status).toBe(200);
      expect((await changeBug('bug-a', B.READY_TO_RETEST)).status).toBe(200);
    } finally { release(); }
    expect((await delayed).status).toBe(409);
    spy.mockRestore();
    const result = await state();
    expect(result.bug.status).toBe(B.READY_TO_RETEST);
    expect(result.tc.status).toBe(T.READY_TO_RETEST);
    expect(result.bug.fixingAt).not.toBeNull();
    expect(result.bug.readyAt).not.toBeNull();
    expect(result.bug.fixedAt).toBeNull();
    expect(result.history.filter(h => h.entityType === 'BugFix')).toHaveLength(2);
  });

  it('6A-VALIDATION: illegal jumps, direct verification and unknown/missing IDs have no effects', async () => {
    await pair('a', B.REPORTED);
    const before = await state();
    for (const status of [B.READY_TO_RETEST, B.VERIFIED_FIXED, 'UNKNOWN']) {
      expect((await changeBug('bug-a', status)).status).toBe(400);
    }
    expect((await changeBug('missing', B.FIXING)).status).toBe(404);
    expect((await changeCase('missing', T.DONE)).status).toBe(404);
    expect((await changeCase('tc-a', 'UNKNOWN')).status).toBe(400);
    expect((await bulk(['tc-a'], 'UNKNOWN')).status).toBe(400);
    expect(await state()).toEqual(before);
  });

  it('6A-SOURCE: an orphaned legacy Bug is not partially updated', async () => {
    await pair();
    // Deliberately corrupt only this disposable fixture; production FK is intact.
    await db.$executeRawUnsafe('PRAGMA foreign_keys=OFF');
    try {
      await db.$executeRawUnsafe("UPDATE BugFix SET sourceTestCaseId = 'missing' WHERE id = 'bug-a'");
    } finally { await db.$executeRawUnsafe('PRAGMA foreign_keys=ON'); }
    const before = await state();
    expect((await changeBug('bug-a', B.READY_TO_RETEST)).status).toBe(404);
    expect(await state()).toEqual(before);
  });

  it('6A-RACE: simultaneous testcase failures cannot duplicate Bugs or history', async () => {
    await pair();
    await db.bugFix.deleteMany();
    await db.testCase.update({ where: { id: 'tc-a' }, data: { status: T.NOT_DONE, actualResult: null } });
    const original = db.testCase.findUnique.bind(db.testCase);
    let arrived = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const reads = vi.spyOn(caseReader(), 'findUnique').mockImplementation(async args => {
      const row = await original(args);
      if (++arrived === 2) release();
      await gate; return row;
    });
    const responses = await Promise.all([changeCase('tc-a', T.FAILED), changeCase('tc-a', T.FAILED)]);
    reads.mockRestore();
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await db.testCase.findUniqueOrThrow({ where: { id: 'tc-a' } })).status).toBe(T.FAILED);
    const bugs = await db.bugFix.findMany();
    expect(bugs).toHaveLength(1);
    expect(bugs[0].status).toBe(B.REPORTED);
    expect(bugs[0].reportedAt).not.toBeNull();
    expect(bugs[0].fixingAt).toBeNull();
    expect(bugs[0].readyAt).toBeNull();
    expect(bugs[0].fixedAt).toBeNull();
    expect(await db.activityHistory.count({ where: { entityId: 'tc-a', field: 'status' } })).toBe(1);
  });

  it('6A-RACE: READY and testcase retest cannot commit contradictory final records', async () => {
    await pair();
    let arrived = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const bugRead = db.bugFix.findUnique.bind(db.bugFix);
    const caseRead = db.testCase.findUnique.bind(db.testCase);
    const wait = async <T,>(row: T) => { if (++arrived === 2) release(); await gate; return row; };
    const a = vi.spyOn(bugReader(), 'findUnique').mockImplementation(async args => wait(await bugRead(args)));
    const b = vi.spyOn(caseReader(), 'findUnique').mockImplementation(async args => wait(await caseRead(args)));
    const responses = await Promise.all([changeBug('bug-a', B.READY_TO_RETEST), changeCase('tc-a', T.DONE)]);
    a.mockRestore(); b.mockRestore();
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    const result = await state();
    if (result.bug.status === B.READY_TO_RETEST) {
      expect(result.tc.status).toBe(T.READY_TO_RETEST);
      expect(result.bug.readyAt).not.toBeNull();
      expect(result.bug.fixedAt).toBeNull();
      expect(result.history.filter(h => h.field === 'status')).toHaveLength(2);
    } else {
      expect(result.bug.status).toBe(B.VERIFIED_FIXED);
      expect(result.tc.status).toBe(T.DONE);
      expect(result.tc.actualResult).toBe(A.AS_EXPECTED);
      expect(result.bug.readyAt).toBeNull();
      expect(result.bug.fixedAt).not.toBeNull();
      expect(result.history.filter(h => h.field === 'status')).toHaveLength(1);
    }
    expect(result.bug.fixingAt).toEqual(oldTime);
    expect(result.bug.reportedAt).toEqual(oldTime);
  });

  it('6A-PROJECT: mismatched Bug/source projects reject and roll back either mutation direction', async () => {
    await pair();
    await db.bugFix.update({ where: { id: 'bug-a' }, data: { projectId: 'q' } });
    const before = await state();
    expect((await changeBug('bug-a', B.READY_TO_RETEST)).status).toBe(409);
    expect((await changeCase('tc-a', T.DONE)).status).toBe(409);
    expect((await bulk(['tc-a'], T.DONE)).status).toBe(409);
    expect(await state()).toEqual(before);
  });

  it('6A-BULK: duplicate/missing IDs count existing unique cases and record each committed field once', async () => {
    await pair('a', B.READY_TO_RETEST);
    await pair('b', B.READY_TO_RETEST);
    const response = await bulk(['tc-a', 'tc-a', 'missing', 'tc-b'], T.DONE);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 2 });
    for (const id of ['a', 'b']) {
      const result = await state(id);
      expect(result.tc.status).toBe(T.DONE);
      expect(result.tc.actualResult).toBe(A.AS_EXPECTED);
      expect(result.bug.status).toBe(B.VERIFIED_FIXED);
      expect(result.bug.reportedAt).toEqual(oldTime);
      expect(result.bug.fixingAt).toEqual(oldTime);
      expect(result.bug.readyAt).toEqual(oldTime);
      expect(result.bug.fixedAt).not.toBeNull();
      expect(result.history.filter(h => h.entityId === `tc-${id}` && h.field === 'status')).toHaveLength(1);
      expect(result.history.filter(h => h.entityId === `tc-${id}` && h.field === 'actualResult')).toHaveLength(1);
    }
    const before = await db.activityHistory.count();
    expect((await bulk(['tc-a', 'tc-b'], T.DONE)).status).toBe(200);
    expect(await db.activityHistory.count()).toBe(before);
    expect(await db.bugFix.count()).toBe(2);
    expect(await (await bulk(['missing'], T.DONE)).json()).toEqual({ updated: 0 });
  });

  it('6A-BULK: failure on the second related Bug rolls back the entire batch', async () => {
    await pair('a', B.READY_TO_RETEST);
    await pair('b', B.READY_TO_RETEST);
    const before = [await state('a'), await state('b')];
    await db.$executeRawUnsafe("CREATE TRIGGER fail_bug BEFORE UPDATE ON BugFix WHEN OLD.id = 'bug-b' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
    expect((await bulk(['tc-a', 'tc-b'], T.DONE)).status).toBe(500);
    expect([await state('a'), await state('b')]).toEqual(before);
  });

  it('6A-CASE-HISTORY: history failure rolls back a new failed testcase and its newly created Bug', async () => {
    await pair();
    await db.bugFix.deleteMany();
    const before = await db.testCase.update({ where: { id: 'tc-a' }, data: { status: T.NOT_DONE, actualResult: null } });
    await db.$executeRawUnsafe("CREATE TRIGGER fail_history BEFORE INSERT ON ActivityHistory BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
    expect((await changeCase('tc-a', T.FAILED)).status).toBe(500);
    expect(await db.testCase.findUniqueOrThrow({ where: { id: 'tc-a' } })).toEqual(before);
    expect(await db.bugFix.count()).toBe(0);
    expect(await db.activityHistory.count()).toBe(0);
  });

  it('6A-BULK: failed retests bounce ready Bugs atomically without duplicate effects', async () => {
    await pair('a', B.READY_TO_RETEST);
    expect((await bulk(['tc-a', 'tc-a'], T.FAILED)).status).toBe(200);
    const result = await state();
    expect(result.tc.status).toBe(T.FAILED);
    expect(result.bug.status).toBe(B.FIXING);
    expect(result.bug.reportedAt).toEqual(oldTime);
    expect(result.bug.readyAt).toEqual(oldTime);
    expect(result.bug.fixingAt!.getTime()).toBeGreaterThan(oldTime.getTime());
    expect(result.bug.fixedAt).toBeNull();
    expect(result.history.filter(h => h.field === 'status')).toHaveLength(2);
    const before = result.bug;
    expect((await bulk(['tc-a'], T.FAILED)).status).toBe(200);
    expect((await state()).bug).toEqual(before);
    expect(await db.activityHistory.count()).toBe(2);
  });

  it('6A-PAGE: Cases and Bugs stay complete across reload and status-only updatedAt changes', async () => {
    for (const id of ['d', 'b', 'a', 'c']) await pair(id);
    for (const direction of ['asc', 'desc']) {
      const expected = ['a', 'b', 'c', 'd'];
      if (direction === 'desc') expected.reverse();
      for (const endpoint of ['bugfix', 'testcases']) {
        const read = async () => {
          const ids: string[] = [];
          for (const page of [1, 2]) {
            const req = new NextRequest(`http://localhost/api/${endpoint}?projectId=p&sortBy=createdAt&sortOrder=${direction}&limit=2&page=${page}`);
            const res = await (endpoint === 'bugfix' ? listBugs(req) : listCases(req));
            expect(res.status).toBe(200);
            const payload = await res.json();
            expect(payload).toMatchObject({ total: 4, totalPages: 2, limit: 2, page });
            ids.push(...payload[endpoint === 'bugfix' ? 'bugFixItems' : 'testCases'].map((row: { id: string }) => row.id));
          }
          return ids;
        };
        const prefix = endpoint === 'bugfix' ? 'bug-' : 'tc-';
        expect(await read()).toEqual(expected.map(id => prefix + id));
        expect(new Set(await read()).size).toBe(4);
        const current = await db.bugFix.findUniqueOrThrow({ where: { id: 'bug-b' } });
        expect((await changeBug('bug-b', current.status === B.FIXING ? B.READY_TO_RETEST : B.FIXING)).status).toBe(200);
        expect(await read()).toEqual(expected.map(id => prefix + id));
      }
    }
  });

  it('6A-SORT: preserves primary fields, directions, filters and the default page size', async () => {
    await pair('a'); await pair('b', B.REPORTED);
    const bugs = vi.spyOn(db.bugFix, 'findMany');
    const cases = vi.spyOn(db.testCase, 'findMany');
    for (const direction of ['asc', 'desc']) {
      for (const field of ['createdAt', 'updatedAt', 'testCaseId', 'page', 'status', 'priority', 'testType']) {
        const suffix = `projectId=p&sortBy=${field}&sortOrder=${direction}`;
        const response = await listCases(new NextRequest(`http://localhost/api/testcases?${suffix}`));
        expect(response.status).toBe(200);
        expect((await response.json()).limit).toBe(50);
        expect(cases.mock.lastCall![0]!.orderBy).toEqual([{ [field]: direction }, { id: direction }]);
        if (field !== 'testType') {
          const response = await listBugs(new NextRequest(`http://localhost/api/bugfix?${suffix}`));
          expect(response.status).toBe(200);
          expect((await response.json()).limit).toBe(50);
          expect(bugs.mock.lastCall![0]!.orderBy).toEqual([{ [field]: direction }, { id: direction }]);
        }
      }
    }
    const filtered = await listBugs(new NextRequest(`http://localhost/api/bugfix?projectId=p&status=${encodeURIComponent(B.REPORTED)}&search=TC-b&sortBy=invalid`));
    expect((await filtered.json()).bugFixItems.map((row: BugFix) => row.id)).toEqual(['bug-b']);
    expect(bugs.mock.lastCall![0]!.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('6A-AUTH: proxy denies missing session, viewer writes and cross-workspace bulk IDs', async () => {
    await pair();
    await db.user.deleteMany();
    await db.user.create({ data: { id: 'qa-user', name: 'QA', email: 'qa@example.test', passwordHash: 'unused' } });
    await db.workspaceMembership.create({ data: { workspaceId: 'w', userId: 'qa-user', role: 'VIEWER' } });
    const { token } = await createSession('qa-user');
    const authorizedRequest = (ids: string[], withSession = true) => {
      const req = request('testcases', 'PATCH', { ids, status: T.DONE });
      req.headers.set('origin', 'http://localhost');
      req.headers.set('host', 'localhost');
      if (withSession) req.cookies.set(SESSION_COOKIE, token);
      return req;
    };
    const before = await state();
    expect((await proxy(authorizedRequest(['tc-a'], false))).status).toBe(401);
    expect((await proxy(authorizedRequest(['tc-a']))).status).toBe(403);
    await db.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId: 'w', userId: 'qa-user' } }, data: { role: 'QA' } });
    expect((await proxy(authorizedRequest(['tc-a']))).headers.get('x-middleware-next')).toBe('1');
    await db.workspace.create({ data: { id: 'other', name: 'Other', slug: 'other' } });
    await db.project.create({ data: { id: 'foreign', name: 'Foreign', workspaceId: 'other' } });
    await pair('foreign', B.REPORTED, 'foreign');
    expect((await proxy(authorizedRequest(['tc-a', 'tc-foreign']))).status).toBe(403);
    expect(await state()).toEqual(before);
    expect((await db.testCase.findUniqueOrThrow({ where: { id: 'tc-foreign' } })).status).toBe(T.FAILED);
  });
});
