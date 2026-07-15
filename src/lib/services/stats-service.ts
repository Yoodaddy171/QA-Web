import { db } from '@/lib/db';
import { calculateDashboardStats } from '@/lib/services/stats-aggregation';

export async function getProjectStats(projectId: string) {
  const [allTestCases, projectModules, bugFixItems, testRuns] = await Promise.all([
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
      include: {
        testCases: { include: { executions: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ]);

  const stats = calculateDashboardStats(allTestCases, bugFixItems, projectModules);
  return { ...stats, releaseReadiness: buildReleaseReadiness(testRuns, bugFixItems) };
}

export function buildReleaseReadiness(testRuns: Array<{ id: string; name: string; status: string; testCases: Array<{ executions: Array<{ status: string }> }> }>, bugFixItems: Array<{ id: string; priority: string; status: string }>) {
  const latestRun = testRuns[0] || null;
  const latestStatuses = latestRun?.testCases.map(item => item.executions[0]?.status || 'NOT RUN') || [];
  const failedCases = latestStatuses.filter(status => status === 'FAILED').length;
  const blockedCases = latestStatuses.filter(status => status === 'BLOCKED').length;
  const notRunCases = latestStatuses.filter(status => status === 'NOT RUN').length;
  const criticalBugs = bugFixItems.filter(item => item.priority === 'Critical' && item.status !== 'VERIFIED & FIXED').length;
  const openBugs = bugFixItems.filter(item => item.status !== 'VERIFIED & FIXED').length;
  const recommendation = criticalBugs > 0 || failedCases > 0 || blockedCases > 0
    ? 'NOT READY'
    : notRunCases > 0 || openBugs > 0
      ? 'READY WITH RISK'
      : 'READY';

  return {
    recommendation,
    testRunId: latestRun?.id || null,
    testRunName: latestRun?.name || null,
    failedCases,
    blockedCases,
    notRunCases,
    criticalBugs,
    openBugs,
    reason: `${criticalBugs} critical bugs, ${failedCases} failed cases, ${blockedCases} blocked cases`,
  } as const;
}
