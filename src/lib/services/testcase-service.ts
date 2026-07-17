import { db } from '@/lib/db';
import { getProgressFromStatus } from '@/lib/domain/progress';
import { resolveTestCaseStatusTransition, TESTCASE_ACTUAL_RESULT, TESTCASE_STATUS } from '@/lib/domain/testcase';
import { syncBugFixForTestCaseStatus, type BugFixSourceSnapshot } from '@/lib/services/bugfix-sync-service';
import { recordActivity } from '@/lib/services/activity-history-service';
import type { Prisma } from '@prisma/client';

export interface CreateTestCaseInput {
  testCaseId: string;
  page: string;
  subMenu: string | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  actualResult: string | null;
  status: string;
  progress: number;
  remarks: string | null;
  tags: string | null;
  priority: string;
  projectId: string;
  moduleId: string | null;
  actor?: string | null;
}

export interface TestCaseUpdateContext extends BugFixSourceSnapshot {
  status: string;
  actualResult: string | null;
  [key: string]: unknown;
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
  actor?: string | null;
}

export async function createTestCaseRecord(input: CreateTestCaseInput) {
  const { actor, ...testCaseData } = input;
  return db.$transaction(async tx => {
    const testCase = await tx.testCase.create({
      data: testCaseData,
      include: { module: { select: { id: true, name: true } } },
    });
    await recordActivity({
      projectId: testCase.projectId,
      entityType: 'TestCase',
      entityId: testCase.id,
      action: 'CREATED',
      afterValue: { testCaseId: testCase.testCaseId, status: testCase.status },
      actor,
    }, tx);
    return testCase;
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

    await recordTestCaseChanges(tx, input, testCase);

    return testCase;
  });
}

// Bulk status change in one transaction, reusing the same transition and
// bug-fix sync rules as the single-case PUT path.
export async function bulkUpdateTestCaseStatus(ids: string[], nextStatus: string) {
  return db.$transaction(async tx => {
    const cases = await tx.testCase.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, status: true, actualResult: true, testCaseId: true, projectId: true,
        page: true, subMenu: true, testType: true, testAction: true, steps: true,
        expectedResult: true, priority: true, moduleId: true,
      },
    });

    for (const current of cases) {
      const { finalStatus, finalActualResult } = resolveTestCaseStatusTransition({
        currentStatus: current.status,
        currentActualResult: current.actualResult,
        nextStatus,
        nextActualResult: undefined,
      });
      const finalActualResultForDb = finalActualResult === '' ? null : finalActualResult;
      const shouldWriteActualResult = finalStatus === TESTCASE_STATUS.DONE
        && finalActualResultForDb === TESTCASE_ACTUAL_RESULT.AS_EXPECTED
        && current.actualResult !== TESTCASE_ACTUAL_RESULT.AS_EXPECTED;

      await tx.testCase.update({
        where: { id: current.id },
        data: {
          status: finalStatus,
          progress: getProgressFromStatus(finalStatus || current.status),
          ...(shouldWriteActualResult && { actualResult: finalActualResultForDb }),
        },
      });
      await syncBugFixForTestCaseStatus({
        client: tx,
        sourceTestCaseId: current.id,
        source: current,
        finalStatus,
        finalActualResult: finalActualResultForDb,
      });
      if (current.status !== finalStatus) {
        await recordActivity({ projectId: current.projectId, entityType: 'TestCase', entityId: current.id, action: 'UPDATED', field: 'status', beforeValue: current.status, afterValue: finalStatus }, tx);
      }
    }

    return { updated: cases.length };
  });
}

export async function deleteTestCasesByIds(ids: string[]) {
  return db.$transaction(async tx => {
    const casesToDelete = await tx.testCase.findMany({
      where: { id: { in: ids } },
      select: { id: true, projectId: true, page: true, subMenu: true, testCaseId: true },
    });
    for (const testCase of casesToDelete) {
      await recordActivity({ projectId: testCase.projectId, entityType: 'TestCase', entityId: testCase.id, action: 'DELETED', beforeValue: { testCaseId: testCase.testCaseId } }, tx);
    }
    await tx.testCase.deleteMany({ where: { id: { in: ids } } });
    return {
      deleted: casesToDelete.length,
    };
  });
}

export async function deleteTestCaseById(id: string) {
  return db.$transaction(async tx => {
    const testCase = await tx.testCase.findUnique({
      where: { id },
      select: { id: true, projectId: true, page: true, subMenu: true, testCaseId: true },
    });
    if (!testCase) return null;

    await recordActivity({ projectId: testCase.projectId, entityType: 'TestCase', entityId: testCase.id, action: 'DELETED', beforeValue: { testCaseId: testCase.testCaseId } }, tx);
    await tx.testCase.delete({ where: { id } });
    return {
      deleted: 1,
    };
  });
}

async function recordTestCaseChanges(tx: Prisma.TransactionClient, input: UpdateTestCaseInput, testCase: { id: string; projectId: string; testCaseId: string; page: string; subMenu: string | null; status: string; actualResult: string | null; testType: string; testAction: string; steps: string; expectedResult: string; priority: string; moduleId: string | null; remarks: string | null; tags: string | null }) {
  const fields: Array<[string, unknown, unknown]> = [
    ['testCaseId', input.current.testCaseId, testCase.testCaseId],
    ['page', input.current.page, testCase.page],
    ['subMenu', input.current.subMenu, testCase.subMenu],
    ['status', input.current.status, testCase.status],
    ['actualResult', input.current.actualResult, testCase.actualResult],
    ['testType', input.current.testType, testCase.testType],
    ['testAction', input.current.testAction, testCase.testAction],
    ['steps', input.current.steps, testCase.steps],
    ['expectedResult', input.current.expectedResult, testCase.expectedResult],
    ['priority', input.current.priority, testCase.priority],
    ['moduleId', input.current.moduleId, testCase.moduleId],
    ['remarks', input.current.remarks, testCase.remarks],
    ['tags', input.current.tags, testCase.tags],
  ];
  for (const [field, beforeValue, afterValue] of fields) {
    if (Object.is(beforeValue, afterValue)) continue;
    await recordActivity({ projectId: testCase.projectId, entityType: 'TestCase', entityId: testCase.id, action: 'UPDATED', field, beforeValue, afterValue, actor: input.actor }, tx);
  }
}

function buildTestCaseUpdateData(input: UpdateTestCaseInput): Prisma.TestCaseUncheckedUpdateInput {
  const data = input.data;
  return {
    ...(data.page !== undefined && { page: cleanText(data.page) }),
    ...(data.subMenu !== undefined && { subMenu: input.finalSubMenu }),
    ...(data.testType !== undefined && { testType: data.testType }),
    ...(data.testAction !== undefined && { testAction: cleanText(data.testAction) }),
    ...(data.steps !== undefined && { steps: cleanText(data.steps) }),
    ...(data.expectedResult !== undefined && { expectedResult: cleanText(data.expectedResult) }),
    ...(input.shouldWriteActualResult && { actualResult: input.finalActualResultForDb }),
    ...(data.stepLogs !== undefined && { stepLogs: data.stepLogs }),
    ...(input.finalStatus !== undefined && { status: input.finalStatus }),
    ...(input.progress !== undefined && { progress: input.progress }),
    ...(data.remarks !== undefined && { remarks: data.remarks }),
    ...(data.tags !== undefined && { tags: data.tags }),
    ...(data.priority !== undefined && { priority: data.priority }),
    ...(data.moduleId !== undefined && { moduleId: input.finalModuleId }),
  };
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
