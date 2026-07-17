import { db } from '@/lib/db';
import { TESTCASE_STATUS } from '@/lib/domain/testcase';

function groupKey(projectId: string, page: string, subMenu: string | null) {
  return `${projectId}\0${page}\0${subMenu || ''}`;
}

export async function getCalculatedWeightMap(projectId?: string) {
  const groups = await db.testCase.groupBy({
    by: ['projectId', 'page', 'subMenu'],
    where: { ...(projectId ? { projectId } : {}), status: { not: TESTCASE_STATUS.TBA } },
    _count: { _all: true },
  });
  return new Map(groups.map(group => [
    groupKey(group.projectId, group.page, group.subMenu),
    group._count._all > 0 ? 100 / group._count._all : null,
  ]));
}

export function calculatedWeightFor(
  weights: Map<string, number | null>,
  testCase: { projectId: string; page: string; subMenu: string | null; status: string },
) {
  if (testCase.status === TESTCASE_STATUS.TBA) return null;
  return weights.get(groupKey(testCase.projectId, testCase.page, testCase.subMenu)) ?? null;
}
