import { db } from '@/lib/db';
import { calculateDashboardStats } from '@/lib/services/stats-aggregation';

export async function getProjectStats(projectId: string) {
  const [allTestCases, projectModules, bugFixItems, testRuns, recentActivities] = await Promise.all([
    db.testCase.findMany({
      where: { projectId },
      select: {
        id: true,
        testCaseId: true,
        page: true,
        subMenu: true,
        status: true,
        testType: true,
        priority: true,
        updatedAt: true,
        moduleId: true,
        module: { select: { id: true, name: true } },
      },
    }),
    db.module.findMany({ where: { projectId } }),
    db.bugFix.findMany({
      where: { projectId },
      select: {
        id: true,
        sourceTestCaseId: true,
        testCaseId: true,
        page: true,
        subMenu: true,
        testAction: true,
        priority: true,
        status: true,
        reportedAt: true,
        fixingAt: true,
        readyAt: true,
        fixedAt: true,
        updatedAt: true,
        moduleId: true,
        module: { select: { id: true, name: true } },
      },
    }),
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
  const runCases = selectedRun ? await db.testRunCase.findMany({
    where: { testRunId: selectedRun.id },
    select: { executions: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } } },
  }) : [];
  const stats = calculateDashboardStats(allTestCases, bugFixItems, projectModules);
  // Reuse already-scoped records: no extra queries or client-side full inventory.
  const activityLabels = new Map<string, string>([
    ...allTestCases.map(item => [`TestCase:${item.id}`, item.testCaseId] as const),
    ...bugFixItems.map(item => [`BugFix:${item.id}`, item.testCaseId] as const),
    ...testRuns.map(item => [`TestRun:${item.id}`, item.name] as const),
  ]);
  // Resolve only the few entities in this feed, always within this project.
  // Select labels only: guest tokens, account credentials and payloads stay private.
  const ids = (type: string) => [...new Set(recentActivities.filter(item => item.entityType === type && !activityLabels.has(`${type}:${item.entityId}`)).map(item => item.entityId))];
  await Promise.all([
    ids('TestExecution').length ? db.testExecution.findMany({ where: { id: { in: ids('TestExecution') }, testRun: { projectId }, testCase: { projectId } }, select: { id: true, testCase: { select: { testCaseId: true } }, testRun: { select: { name: true } } } }).then(rows => rows.forEach(row => activityLabels.set(`TestExecution:${row.id}`, `${row.testCase.testCaseId} · ${row.testRun.name}`))) : null,
    ids('GuestAccessGrant').length ? db.guestAccessGrant.findMany({ where: { id: { in: ids('GuestAccessGrant') }, projects: { some: { projectId } } }, select: { id: true, label: true } }).then(rows => rows.forEach(row => activityLabels.set(`GuestAccessGrant:${row.id}`, row.label))) : null,
    ids('WorkspaceMembership').length ? db.workspaceMembership.findMany({ where: { id: { in: ids('WorkspaceMembership') }, workspace: { projects: { some: { id: projectId } } } }, select: { id: true, user: { select: { name: true } } } }).then(rows => rows.forEach(row => activityLabels.set(`WorkspaceMembership:${row.id}`, row.user.name))) : null,
    ids('Requirement').length ? db.requirement.findMany({ where: { id: { in: ids('Requirement') }, projectId }, select: { id: true, title: true } }).then(rows => rows.forEach(row => activityLabels.set(`Requirement:${row.id}`, row.title))) : null,
    ids('TestPlan').length ? db.testPlan.findMany({ where: { id: { in: ids('TestPlan') }, projectId }, select: { id: true, name: true } }).then(rows => rows.forEach(row => activityLabels.set(`TestPlan:${row.id}`, row.name))) : null,
    ids('TestRun').length ? db.testRun.findMany({ where: { id: { in: ids('TestRun') }, projectId }, select: { id: true, name: true } }).then(rows => rows.forEach(row => activityLabels.set(`TestRun:${row.id}`, row.name))) : null,
  ]);
  return { ...stats, releaseReadiness: buildReleaseReadiness(selectedRun ? [{ ...selectedRun, testCases: runCases }] : [], bugFixItems), recentActivities: recentActivities.map(item => ({ ...item, entityLabel: activityLabels.get(`${item.entityType}:${item.entityId}`) || null })) };
}

export function buildReleaseReadiness(testRuns: Array<{ id: string; name: string; status: string; testCases: Array<{ executions: Array<{ status: string }> }> }>, bugFixItems: Array<{ id: string; priority: string; status: string }>) {
  const latestRun = testRuns.find(run => run.status === 'IN PROGRESS')
    || testRuns.find(run => run.status === 'READY')
    || testRuns[0]
    || null;
  const latestStatuses = latestRun?.testCases.map(item => item.executions[0]?.status || 'NOT RUN') || [];
  const failedCases = latestStatuses.filter(status => status === 'FAILED').length;
  const blockedCases = latestStatuses.filter(status => status === 'BLOCKED').length;
  const notRunCases = latestStatuses.filter(status => status === 'NOT RUN').length;
  const criticalBugs = bugFixItems.filter(item => item.priority === 'Critical' && item.status !== 'VERIFIED & FIXED').length;
  const openBugs = bugFixItems.filter(item => item.status !== 'VERIFIED & FIXED').length;
  const completedCases = latestStatuses.filter(status => status !== 'NOT RUN').length;
  const passedCases = latestStatuses.filter(status => status === 'PASSED' || status === 'VERIFIED').length;
  const totalCases = latestStatuses.length;
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
