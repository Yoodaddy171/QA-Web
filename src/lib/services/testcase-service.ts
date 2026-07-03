import { db } from '@/lib/db';
import { syncBugFixForTestCaseStatus, type BugFixSourceSnapshot } from '@/lib/services/bugfix-sync-service';
import type { WeightRecalculationTarget } from '@/lib/services/weight-service';
import type { Prisma } from '@prisma/client';

export interface CreateTestCaseInput {
  testCaseId: string;
  page: string;
  subMenu: string | null;
  weight: string | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  actualResult: string | null;
  status: string;
  progress: number;
  remarks: string | null;
  priority: string;
  projectId: string;
  moduleId: string | null;
}

export interface TestCaseUpdateContext extends BugFixSourceSnapshot {
  status: string;
  actualResult: string | null;
}

export interface UpdateTestCaseInput {
  id: string;
  data: Record<string, any>;
  current: TestCaseUpdateContext;
  finalStatus: string;
  finalActualResultForDb: string | null;
  shouldWriteActualResult: boolean;
  progress: number;
  finalModuleId: string | null;
  finalSubMenu: string | null;
}

export async function createTestCaseRecord(input: CreateTestCaseInput) {
  return db.testCase.create({
    data: input,
    include: { module: { select: { id: true, name: true } } },
  });
}

export async function updateTestCaseRecordWithBugFixSync(input: UpdateTestCaseInput) {
  return db.$transaction(async tx => {
    const testCase = await tx.testCase.update({
      where: { id: input.id },
      data: buildTestCaseUpdateData(input),
      include: { module: { select: { id: true, name: true } } },
    });

    await syncBugFixForTestCaseStatus({
      client: tx,
      sourceTestCaseId: input.id,
      source: input.current,
      finalStatus: input.finalStatus,
      finalActualResult: input.finalActualResultForDb,
    });

    return testCase;
  });
}

export async function deleteTestCasesByIds(ids: string[]) {
  return db.$transaction(async tx => {
    const casesToDelete = await tx.testCase.findMany({
      where: { id: { in: ids } },
      select: { id: true, projectId: true, page: true, subMenu: true },
    });
    await tx.testCase.deleteMany({ where: { id: { in: ids } } });
    return {
      deleted: ids.length,
      weightTargets: casesToDelete.map(toWeightTarget),
    };
  });
}

export async function deleteTestCaseById(id: string) {
  return db.$transaction(async tx => {
    const testCase = await tx.testCase.findUnique({
      where: { id },
      select: { id: true, projectId: true, page: true, subMenu: true },
    });
    if (!testCase) return null;

    await tx.testCase.delete({ where: { id } });
    return {
      deleted: 1,
      weightTargets: [toWeightTarget(testCase)],
    };
  });
}

function buildTestCaseUpdateData(input: UpdateTestCaseInput): Prisma.TestCaseUncheckedUpdateInput {
  const data = input.data;
  return {
    ...(data.testCaseId !== undefined && { testCaseId: cleanText(data.testCaseId) }),
    ...(data.page !== undefined && { page: cleanText(data.page) }),
    ...(data.subMenu !== undefined && { subMenu: input.finalSubMenu }),
    ...(data.weight !== undefined && { weight: data.weight }),
    ...(data.testType !== undefined && { testType: data.testType }),
    ...(data.testAction !== undefined && { testAction: cleanText(data.testAction) }),
    ...(data.steps !== undefined && { steps: cleanText(data.steps) }),
    ...(data.expectedResult !== undefined && { expectedResult: cleanText(data.expectedResult) }),
    ...(input.shouldWriteActualResult && { actualResult: input.finalActualResultForDb }),
    ...(data.stepLogs !== undefined && { stepLogs: data.stepLogs }),
    ...(input.finalStatus !== undefined && { status: input.finalStatus }),
    ...(input.progress !== undefined && { progress: input.progress }),
    ...(data.remarks !== undefined && { remarks: data.remarks }),
    ...(data.priority !== undefined && { priority: data.priority }),
    ...(data.moduleId !== undefined && { moduleId: input.finalModuleId }),
  };
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toWeightTarget(testCase: WeightRecalculationTarget): WeightRecalculationTarget {
  return {
    projectId: testCase.projectId,
    page: testCase.page,
    subMenu: testCase.subMenu,
  };
}
