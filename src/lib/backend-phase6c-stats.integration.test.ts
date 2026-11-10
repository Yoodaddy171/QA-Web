import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { seedAuthorizationFixture } from '../../scripts/phase6b-fixture.mjs';
const fixture = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qadesk-phase6c-stats-'));
  return { root, url: `file:${path.join(root, 'synthetic.db').replaceAll('\\', '/')}` };
});
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('@prisma/client');
  return { db: new PrismaClient({ datasourceUrl: fixture.url, log: [] }) };
});
import { db } from '@/lib/db';
import { getProjectStats, buildReleaseReadiness } from '@/lib/services/stats-service';
import { calculateDashboardStats } from '@/lib/services/stats-aggregation';
let data: Awaited<ReturnType<typeof seedAuthorizationFixture>>;
beforeAll(async () => {
  await fs.writeFile(path.join(fixture.root, 'synthetic.db'), '');
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', path.resolve('prisma/sqlite.prisma'), '--skip-generate'], { env: { ...process.env, DATABASE_URL: fixture.url }, stdio: 'pipe' });
  data = await seedAuthorizationFixture(db);
}, 60000);
afterAll(async () => {
  await db.$disconnect();
  if (!path.resolve(fixture.root).includes(`${path.sep}qadesk-phase6c-stats-`)) throw new Error('Invalid test cleanup');
  await fs.rm(fixture.root, { recursive: true, force: true });
});
it.each([
  ['IN PROGRESS preferred', ['READY', 'IN PROGRESS', 'COMPLETED']],
  ['READY preferred', ['COMPLETED', 'READY', 'DRAFT']],
  ['newest fallback', ['COMPLETED', 'DRAFT', 'COMPLETED']],
  ['empty', []],
])('6C-STATS: %s matches legacy release output on real SQLite without foreign data', async (_label, statuses) => {
  const a = data.resources.a;
  await db.testRun.deleteMany({ where: { projectId: a.project.id } });
  for (const [i, status] of statuses.entries()) {
    const run = await db.testRun.create({ data: { projectId: a.project.id, name: `Cycle ${i}`, status,
      updatedAt: new Date(Date.UTC(2026, 0, 20 - i)) } });
    const member = await db.testRunCase.create({ data: { testRunId: run.id, testCaseId: a.tc.id } });
    for (const [j, result] of ['PASSED', i === 1 ? 'FAILED' : 'BLOCKED'].entries()) {
      await db.testExecution.create({ data: { testRunId: run.id, testRunCaseId: member.id, testCaseId: a.tc.id,
        status: result, notes: 'Synthetic unused detail', createdAt: new Date(Date.UTC(2026, 0, 1) + j * 1000) } });
    }
  }
  const oldRuns = await db.testRun.findMany({ where: { projectId: a.project.id, status: { not: 'ARCHIVED' } },
    include: { testCases: { include: { executions: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
    orderBy: { updatedAt: 'desc' }, take: 10 });
  const bugs = await db.bugFix.findMany({ where: { projectId: a.project.id } });
  const actual = await getProjectStats(a.project.id);
  expect(actual.releaseReadiness).toEqual(buildReleaseReadiness(oldRuns, bugs));
  expect(actual.totalTestCases).toBe(1);
  expect(JSON.stringify(actual)).not.toContain(data.resources.b.tc.id);
});

it('STATS-EQUIVALENCE: grouped counters and bounded queues preserve a mixed full-inventory snapshot', async () => {
  const projectId = data.resources.a.project.id;
  const modules = await Promise.all(['Alpha', 'Beta'].map(name => db.module.create({ data: { projectId, name } })));
  const statuses = ['DONE', 'NOT DONE', 'IN PROGRESS', 'BLOCKED', 'FAILED', 'READY TO RETEST', 'TBA', 'UNKNOWN'];
  for (let i = 0; i < 60; i++) {
    await db.testCase.create({ data: {
      projectId, testCaseId: `OPT-${i}`, page: `Page ${i % 4}`, subMenu: i % 2 ? 'Sub' : null,
      moduleId: i % 3 === 0 ? null : modules[i % 2].id, testType: i % 2 ? 'Negative' : 'Positive',
      testAction: 'Synthetic action', steps: 'Synthetic steps', expectedResult: 'Expected',
      status: i < 16 ? 'READY TO RETEST' : statuses[i % statuses.length], priority: ['Low', 'Medium', 'High', 'Critical'][i % 4],
      updatedAt: new Date(Date.UTC(2020, 0, i + 1)),
    } });
  }
  for (let i = 0; i < 18; i++) await db.bugFix.create({ data: {
    projectId, sourceTestCaseId: data.resources.a.tc.id, actualResult: 'Not As Expected', testCaseId: `BUG-${i}`, page: 'Bugs', testType: 'Negative', testAction: 'Synthetic bug',
    steps: 'Synthetic steps', expectedResult: 'Expected', status: ['SUDAH DILAPORKAN', 'SEDANG DI FIX', 'READY TO RETEST', 'VERIFIED & FIXED'][i % 4],
    priority: i % 2 ? 'Critical' : 'High', reportedAt: new Date(Date.UTC(2010, 0, i + 1)),
    fixingAt: i % 2 ? new Date(Date.UTC(2011, 0, i + 1)) : null,
  } });
  const [cases, bugs, projectModules] = await Promise.all([
    db.testCase.findMany({ where: { projectId }, include: { module: { select: { id: true, name: true } } } }),
    db.bugFix.findMany({ where: { projectId }, include: { module: { select: { id: true, name: true } } } }),
    db.module.findMany({ where: { projectId } }),
  ]);
  const legacy = calculateDashboardStats(cases, bugs, projectModules);
  const caseReads = vi.spyOn(db.testCase, 'findMany');
  const bugReads = vi.spyOn(db.bugFix, 'findMany');
  const actual = await getProjectStats(projectId);
  expect(actual).toEqual({ ...legacy, releaseReadiness: buildReleaseReadiness([], bugs), recentActivities: [] });
  expect(actual.retestQueue).toHaveLength(8);
  expect(actual.bugAging).toHaveLength(8);
  expect(actual.weightMap).toHaveProperty(cases.find(item => item.status === 'DONE')!.id);
  expect(JSON.stringify(actual)).not.toContain(data.resources.b.tc.id);
  const queueQuery = caseReads.mock.calls.find(([query]) => query?.where?.status === 'READY TO RETEST')?.[0];
  expect(queueQuery).toMatchObject({ take: 8 });
  const inventoryQuery = caseReads.mock.calls.find(([query]) => !query?.where?.status)?.[0];
  expect(inventoryQuery?.select).not.toHaveProperty('updatedAt');
  expect(inventoryQuery?.select).not.toHaveProperty('testType');
  expect(bugReads.mock.calls.every(([query]) => Array.isArray((query?.where?.id as { in?: unknown[] })?.in) && ((query?.where?.id as { in: unknown[] }).in.length <= 8))).toBe(true);
  caseReads.mockRestore(); bugReads.mockRestore();
});
