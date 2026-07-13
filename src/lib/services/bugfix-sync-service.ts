import { db } from '@/lib/db';
import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { TESTCASE_ACTUAL_RESULT, TESTCASE_STATUS } from '@/lib/domain/testcase';
import type { Prisma } from '@prisma/client';

type DbClient = typeof db | Prisma.TransactionClient;

export interface BugFixSourceSnapshot {
  projectId: string;
  testCaseId: string;
  page: string;
  subMenu: string | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  priority: string;
  moduleId: string | null;
}

export async function syncBugFixForTestCaseStatus(input: {
  client?: DbClient;
  sourceTestCaseId: string;
  source: BugFixSourceSnapshot;
  finalStatus: string;
  finalActualResult: string | null;
}) {
  const client = input.client ?? db;

  if (input.finalStatus === TESTCASE_STATUS.FAILED) {
    // Already tracked in the active queue — nothing to do.
    const activeBugFix = await client.bugFix.findFirst({
      where: {
        sourceTestCaseId: input.sourceTestCaseId,
        status: { not: BUGFIX_STATUS.VERIFIED_FIXED },
      },
      select: { id: true },
    });
    if (activeBugFix) return;

    // Regression: the case was previously verified & fixed but failed again.
    // Reopen the resolved bug instead of leaving it hidden in "resolved".
    const resolvedBugFix = await client.bugFix.findFirst({
      where: {
        sourceTestCaseId: input.sourceTestCaseId,
        status: BUGFIX_STATUS.VERIFIED_FIXED,
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    const snapshot = {
      testCaseId: input.source.testCaseId,
      projectId: input.source.projectId,
      page: input.source.page,
      subMenu: input.source.subMenu,
      testType: input.source.testType,
      testAction: input.source.testAction,
      steps: input.source.steps,
      expectedResult: input.source.expectedResult,
      actualResult: TESTCASE_ACTUAL_RESULT.NOT_AS_EXPECTED,
      priority: input.source.priority,
      moduleId: input.source.moduleId,
    };

    if (resolvedBugFix) {
      await client.bugFix.update({
        where: { id: resolvedBugFix.id },
        data: {
          ...snapshot,
          status: BUGFIX_STATUS.REPORTED,
          reportedAt: new Date(),
          fixingAt: null,
          readyAt: null,
          fixedAt: null,
        },
      });
      return;
    }

    // First-time failure.
    await client.bugFix.create({
      data: {
        sourceTestCaseId: input.sourceTestCaseId,
        ...snapshot,
        status: BUGFIX_STATUS.REPORTED,
        reportedAt: new Date(),
      },
    });
    return;
  }

  if (input.finalStatus === TESTCASE_STATUS.DONE || input.finalActualResult === TESTCASE_ACTUAL_RESULT.AS_EXPECTED) {
    await client.bugFix.updateMany({
      where: {
        sourceTestCaseId: input.sourceTestCaseId,
        status: { not: BUGFIX_STATUS.VERIFIED_FIXED },
      },
      data: {
        status: BUGFIX_STATUS.VERIFIED_FIXED,
        fixedAt: new Date(),
      },
    });
  }
}
