import { db } from '@/lib/db';
import { TESTCASE_STATUS } from '@/lib/domain/testcase';
import type { Prisma } from '@prisma/client';

type DbClient = typeof db | Prisma.TransactionClient;

export interface WeightRecalculationTarget {
  projectId: string;
  page: string;
  subMenu: string | null;
}

export function weightTargetKey(target: WeightRecalculationTarget) {
  return `${target.projectId}|||${target.page}|||${target.subMenu || ''}`;
}

export function parseWeightTargetKey(key: string): WeightRecalculationTarget {
  const [projectId, page, subMenu] = key.split('|||');
  return { projectId, page, subMenu: subMenu === '' ? null : subMenu };
}

export function uniqueWeightTargets(targets: WeightRecalculationTarget[]) {
  return Array.from(new Set(targets.map(weightTargetKey))).map(parseWeightTargetKey);
}

export async function recalculateWeights(
  projectId: string,
  page: string,
  subMenu: string | null,
  client: DbClient = db
) {
  const casesInMenu = await client.testCase.findMany({
    where: { projectId, page, subMenu: subMenu || null, status: { not: TESTCASE_STATUS.TBA } },
    select: { id: true },
  });

  if (casesInMenu.length === 0) return;

  const weightPerCase = `${(100 / casesInMenu.length).toFixed(2)}%`;
  const caseIds = casesInMenu.map(tc => tc.id);

  await client.testCase.updateMany({
    where: { id: { in: caseIds } },
    data: { weight: weightPerCase },
  });

  await client.testCase.updateMany({
    where: { projectId, page, subMenu: subMenu || null, status: TESTCASE_STATUS.TBA },
    data: { weight: null },
  });
}

export function scheduleWeightRecalculation(targets: WeightRecalculationTarget[], reason: string) {
  for (const target of uniqueWeightTargets(targets)) {
    recalculateWeights(target.projectId, target.page, target.subMenu).catch(error => {
      console.error(`[weight-service] Failed to recalculate weights after ${reason}:`, error);
    });
  }
}
