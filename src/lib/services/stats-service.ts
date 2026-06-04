import { db } from '@/lib/db';
import { calculateDashboardStats } from '@/lib/services/stats-aggregation';

export async function getProjectStats(projectId: string) {
  const allTestCases = await db.testCase.findMany({
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
  });

  const projectModules = await db.module.findMany({ where: { projectId } });

  const bugFixItems = await db.bugFix.findMany({
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
  });

  return calculateDashboardStats(allTestCases, bugFixItems, projectModules);
}
