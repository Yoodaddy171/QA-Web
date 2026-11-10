import { db } from '@/lib/db';
import { aggregateBugFixCounts, buildBugAging, buildRetestQueue, calculateDashboardInventory } from '@/lib/services/stats-aggregation';
import { Prisma } from '@prisma/client';
import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { TESTCASE_STATUS } from '@/lib/domain/testcase';

const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof loadProjectStats>>>>();

export async function getProjectStats(projectId: string) {
  const pending = inFlight.get(projectId);
  if (pending) return pending;
  const request = loadProjectStats(projectId);
  if (inFlight.size < 128) inFlight.set(projectId, request);
  try { return await request; }
  finally { if (inFlight.get(projectId) === request) inFlight.delete(projectId); }
}

const bugAgingSelect = {
  id: true, sourceTestCaseId: true, testCaseId: true, page: true, subMenu: true, testAction: true,
  priority: true, status: true, reportedAt: true, fixingAt: true, readyAt: true, fixedAt: true,
  updatedAt: true, moduleId: true, module: { select: { id: true, name: true } },
} as const;

async function loadProjectStats(projectId: string) {
  const [allTestCases, projectModules, testcaseCounts, bugGroups, retestCases, agingIds, testRuns, recentActivities] = await Promise.all([
    db.testCase.findMany({
      where: { projectId },
      select: {
        id: true,
        testCaseId: true,
        page: true,
        subMenu: true,
        status: true,
        moduleId: true,
      },
    }),
    db.module.findMany({ where: { projectId }, select: { id: true, name: true } }),
    db.testCase.groupBy({ by: ['status', 'testType', 'priority'], where: { projectId }, _count: { _all: true } }),
    db.bugFix.groupBy({ by: ['status', 'priority'], where: { projectId }, _count: { _all: true } }),
    db.testCase.findMany({
      where: { projectId, status: TESTCASE_STATUS.READY_TO_RETEST },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: 8,
      select: {
        id: true, testCaseId: true, page: true, subMenu: true, status: true, testType: true,
        priority: true, updatedAt: true, moduleId: true,
        module: { select: { id: true, name: true } },
      },
    }),
    db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "BugFix" WHERE "projectId" = ${projectId}
      AND "status" IN (${BUGFIX_STATUS.REPORTED}, ${BUGFIX_STATUS.FIXING})
      ORDER BY COALESCE("fixingAt", "reportedAt", "updatedAt") ASC, "id" ASC LIMIT 8
    `),
    db.testRun.findMany({
      where: { projectId, status: { not: 'ARCHIVED' } },
      select: { id: true, name: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    db.activityHistory.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        action: true,
        field: true,
        beforeValue: true,
        afterValue: true,
        actor: true,
        createdAt: true,
      },
    }),
  ]);

  // Readiness consumes just one of the ten candidates. Avoid materializing the
  // testcase/execution graph (including unused notes) for every other cycle.
  const selectedRun = testRuns.find(run => run.status === 'IN PROGRESS')
    || testRuns.find(run => run.status === 'READY') || testRuns[0] || null;
  const [runCounts, agingRows] = await Promise.all([
    selectedRun ? db.$queryRaw<Array<{ status: string; count: bigint | number }>>(Prisma.sql`
      SELECT COALESCE(NULLIF(latest."status", ''), 'NOT RUN') AS "status", COUNT(*) AS "count"
      FROM "TestRunCase" membership
      LEFT JOIN (
        SELECT "testRunCaseId", "status", ROW_NUMBER() OVER (
          PARTITION BY "testRunCaseId" ORDER BY "createdAt" DESC, "id" DESC
        ) AS position FROM "TestExecution" WHERE "testRunId" = ${selectedRun.id}
      ) latest ON latest."testRunCaseId" = membership."id" AND latest.position = 1
      WHERE membership."testRunId" = ${selectedRun.id} GROUP BY COALESCE(NULLIF(latest."status", ''), 'NOT RUN')
    `) : [],
    agingIds.length ? db.bugFix.findMany({ where: { projectId, id: { in: agingIds.map(item => item.id) } }, select: bugAgingSelect }) : [],
  ]);
  const bugs = { bugFixTotal: 0, ...aggregateBugFixCounts([]) };
  let criticalBugs = 0; let openBugs = 0;
  for (const group of bugGroups) {
    const count = group._count._all;
    bugs.bugFixTotal += count;
    const status = aggregateBugFixCounts([{ status: group.status }]);
    for (const key of Object.keys(status) as Array<keyof typeof status>) bugs[key] += status[key] * count;
    if (group.status !== BUGFIX_STATUS.VERIFIED_FIXED) {
      openBugs += count;
      if (group.priority === 'Critical') criticalBugs += count;
    }
  }
  const moduleById = new Map(projectModules.map(item => [item.id, { id: item.id, name: item.name }]));
  const inventory = allTestCases.map(item => ({ ...item, module: item.moduleId ? moduleById.get(item.moduleId) || null : null }));
  const stats = calculateDashboardInventory(inventory, projectModules, testcaseCounts, bugs);
  const agingById = new Map(agingRows.map(item => [item.id, item] as const));
  const now = Date.now();
  // The legacy response still needs inventory IDs for weights/menu progress, not steps or full bug records.
  const activityLabels = new Map<string, string>([
    ...allTestCases.map(item => [`TestCase:${item.id}`, item.testCaseId] as const),
    ...agingRows.map(item => [`BugFix:${item.id}`, item.testCaseId] as const),
    ...testRuns.map(item => [`TestRun:${item.id}`, item.name] as const),
  ]);
  // Resolve only the few entities in this feed, always within this project.
  // Select labels only: guest tokens, account credentials and payloads stay private.
  const ids = (type: string) => [...new Set(recentActivities.filter(item => item.entityType === type && !activityLabels.has(`${type}:${item.entityId}`)).map(item => item.entityId))];
  await Promise.all([
    ids('BugFix').length ? db.bugFix.findMany({ where: { id: { in: ids('BugFix') }, projectId }, select: { id: true, testCaseId: true } }).then(rows => rows.forEach(row => activityLabels.set(`BugFix:${row.id}`, row.testCaseId))) : null,
    ids('TestExecution').length ? db.testExecution.findMany({ where: { id: { in: ids('TestExecution') }, testRun: { projectId }, testCase: { projectId } }, select: { id: true, testCase: { select: { testCaseId: true } }, testRun: { select: { name: true } } } }).then(rows => rows.forEach(row => activityLabels.set(`TestExecution:${row.id}`, `${row.testCase.testCaseId} · ${row.testRun.name}`))) : null,
    ids('GuestAccessGrant').length ? db.guestAccessGrant.findMany({ where: { id: { in: ids('GuestAccessGrant') }, projects: { some: { projectId } } }, select: { id: true, label: true } }).then(rows => rows.forEach(row => activityLabels.set(`GuestAccessGrant:${row.id}`, row.label))) : null,
    ids('WorkspaceMembership').length ? db.workspaceMembership.findMany({ where: { id: { in: ids('WorkspaceMembership') }, workspace: { projects: { some: { id: projectId } } } }, select: { id: true, user: { select: { name: true } } } }).then(rows => rows.forEach(row => activityLabels.set(`WorkspaceMembership:${row.id}`, row.user.name))) : null,
    ids('Requirement').length ? db.requirement.findMany({ where: { id: { in: ids('Requirement') }, projectId }, select: { id: true, title: true } }).then(rows => rows.forEach(row => activityLabels.set(`Requirement:${row.id}`, row.title))) : null,
    ids('TestPlan').length ? db.testPlan.findMany({ where: { id: { in: ids('TestPlan') }, projectId }, select: { id: true, name: true } }).then(rows => rows.forEach(row => activityLabels.set(`TestPlan:${row.id}`, row.name))) : null,
    ids('TestRun').length ? db.testRun.findMany({ where: { id: { in: ids('TestRun') }, projectId }, select: { id: true, name: true } }).then(rows => rows.forEach(row => activityLabels.set(`TestRun:${row.id}`, row.name))) : null,
  ]);
  return { ...stats, retestQueue: buildRetestQueue(retestCases, now),
    bugAging: buildBugAging(agingIds.flatMap(item => agingById.has(item.id) ? [agingById.get(item.id)!] : []), now),
    releaseReadiness: releaseReadinessFromCounts(selectedRun, runCounts.map(row => ({ status: row.status, count: Number(row.count) })), criticalBugs, openBugs),
    recentActivities: recentActivities.map(item => ({ ...item, entityLabel: activityLabels.get(`${item.entityType}:${item.entityId}`) || null })),
  };
}

export function buildReleaseReadiness(testRuns: Array<{ id: string; name: string; status: string; testCases: Array<{ executions: Array<{ status: string }> }> }>, bugFixItems: Array<{ id: string; priority: string; status: string }>) {
  const latestRun = testRuns.find(run => run.status === 'IN PROGRESS')
    || testRuns.find(run => run.status === 'READY')
    || testRuns[0]
    || null;
  const latestStatuses = latestRun?.testCases.map(item => item.executions[0]?.status || 'NOT RUN') || [];
  const criticalBugs = bugFixItems.filter(item => item.priority === 'Critical' && item.status !== 'VERIFIED & FIXED').length;
  const openBugs = bugFixItems.filter(item => item.status !== 'VERIFIED & FIXED').length;
  const counts = new Map<string, number>();
  for (const status of latestStatuses) counts.set(status, (counts.get(status) || 0) + 1);
  return releaseReadinessFromCounts(latestRun, [...counts].map(([status, count]) => ({ status, count })), criticalBugs, openBugs);
}

function releaseReadinessFromCounts(latestRun: { id: string; name: string; status: string } | null,
  rows: Array<{ status: string; count: number }>, criticalBugs: number, openBugs: number) {
  const counts = new Map(rows.map(row => [row.status, row.count]));
  const failedCases = counts.get('FAILED') || 0;
  const blockedCases = counts.get('BLOCKED') || 0;
  const notRunCases = counts.get('NOT RUN') || 0;
  const totalCases = rows.reduce((sum, row) => sum + row.count, 0);
  const completedCases = totalCases - notRunCases;
  const passedCases = (counts.get('PASSED') || 0) + (counts.get('VERIFIED') || 0);
  const recommendation = criticalBugs > 0 || failedCases > 0 || blockedCases > 0
    ? 'NOT READY'
    : notRunCases > 0 || openBugs > 0
      ? 'READY WITH RISK'
      : 'READY';

  return {
    recommendation,
    testRunId: latestRun?.id || null,
    testRunName: latestRun?.name || null,
    testRunStatus: latestRun?.status || null,
    totalCases,
    completedCases,
    passedCases,
    progress: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
    failedCases,
    blockedCases,
    notRunCases,
    criticalBugs,
    openBugs,
    reason: `Run aktif/terbaru: ${criticalBugs} critical bugs, ${failedCases} failed executions, ${blockedCases} blocked executions`,
  } as const;
}
