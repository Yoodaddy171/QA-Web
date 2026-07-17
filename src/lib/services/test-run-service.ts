import { db } from '@/lib/db';
import { TEST_EXECUTION_STATUS, TEST_RUN_STATUS } from '@/lib/domain/test-run';
import { recordActivity } from '@/lib/services/activity-history-service';
import { createNotification } from '@/lib/services/notification-service';
import type { Prisma } from '@prisma/client';

type DbClient = typeof db;
type TransactionClient = Prisma.TransactionClient;

const testRunInclude = {
  _count: { select: { testCases: true, executions: true } },
} as const;

export async function listTestRuns(projectId: string, options: { cursor?: string; limit?: number } = {}) {
  const limit = Math.min(100, Math.max(1, options.limit || 25));
  const runs = await db.testRun.findMany({
    where: { projectId },
    include: {
      ...testRunInclude,
      testCases: { select: { latestStatus: true } },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = runs.length > limit;
  const page = hasMore ? runs.slice(0, limit) : runs;
  const items = page.map(run => {
    const summary = summarizeStatuses(run.testCases.map(item => item.latestStatus));
    return {
      ...run,
      progress: summary.total ? Math.round((summary.completed / summary.total) * 100) : 0,
      summary,
    };
  });
  return { items, hasMore, nextCursor: hasMore ? page.at(-1)?.id || null : null };
}

export async function getTestRunCasesPage(projectId: string, id: string, options: { cursor?: string; limit?: number } = {}) {
  const limit = Math.min(200, Math.max(1, options.limit || 100));
  if (!await db.testRun.findFirst({ where: { id, projectId }, select: { id: true } })) return null;
  const rows = await db.testRunCase.findMany({
    where: { testRunId: id },
    include: {
      testCase: { include: { module: { select: { id: true, name: true } } } },
      executions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map(item => ({ ...item.testCase, membershipId: item.id, assignedTo: item.assignedTo, executions: item.executions })),
    hasMore,
    nextCursor: hasMore ? page.at(-1)?.id || null : null,
  };
}

export async function getTestRun(projectId: string, id: string, options: { caseCursor?: string; caseLimit?: number } = {}) {
  const [run, statusRows, casePage] = await Promise.all([db.testRun.findFirst({
    where: { id, projectId },
    include: {
      testPlan: true,
      _count: { select: { testCases: true, executions: true } },
    },
  }), db.testRunCase.findMany({
    where: { testRunId: id },
    select: { latestStatus: true },
  }), getTestRunCasesPage(projectId, id, { cursor: options.caseCursor, limit: options.caseLimit })]);
  if (!run) return null;

  const latestStatuses = statusRows.map(item => item.latestStatus);
  const summary = summarizeStatuses(latestStatuses);
  return {
    ...run,
    testCases: casePage?.items || [],
    casePage: { hasMore: casePage?.hasMore || false, nextCursor: casePage?.nextCursor || null },
    progress: summary.total ? Math.round((summary.completed / summary.total) * 100) : 0,
    summary,
  };
}

export async function createTestRun(input: {
  projectId: string;
  name: string;
  description?: string | null;
  status?: string;
  testPlanId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  createdBy?: string | null;
  assignedTo?: string | null;
}) {
  const testRun = await db.testRun.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      description: input.description || null,
      status: input.status || TEST_RUN_STATUS.DRAFT,
      testPlanId: input.testPlanId || null,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      createdBy: input.createdBy || 'system',
      assignedTo: input.assignedTo || null,
    },
    include: testRunInclude,
  });
  await recordActivity({ projectId: input.projectId, entityType: 'TestRun', entityId: testRun.id, action: 'CREATED', afterValue: { name: testRun.name, status: testRun.status }, actor: input.createdBy });
  return testRun;
}

export async function updateTestRun(projectId: string, id: string, data: {
  name?: string;
  description?: string | null;
  status?: string;
  testPlanId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  assignedTo?: string | null;
}) {
  const existing = await db.testRun.findFirst({ where: { id, projectId }, select: { id: true, name: true, status: true, description: true, assignedTo: true } });
  if (!existing) return null;

  const updated = await db.testRun.update({
    where: { id },
    data,
    include: testRunInclude,
  });
  for (const field of ['name', 'status', 'description', 'assignedTo'] as const) {
    if (data[field] !== undefined && data[field] !== existing[field]) {
      await recordActivity({ projectId, entityType: 'TestRun', entityId: id, action: 'UPDATED', field, beforeValue: existing[field], afterValue: data[field] });
    }
  }
  if (data.status === TEST_RUN_STATUS.COMPLETED && existing.status !== TEST_RUN_STATUS.COMPLETED) {
    await createNotification({
      projectId,
      type: 'TEST_RUN_COMPLETED',
      severity: 'success',
      title: 'Test Run selesai',
      message: `${updated.name} telah selesai dan siap direview.`,
      entityType: 'TestRun',
      entityId: updated.id,
      metadata: { tab: 'testRuns' },
      dedupeKey: `test-run-completed:${updated.id}`,
    });
  }
  return updated;
}

export async function deleteTestRun(projectId: string, id: string) {
  const existing = await db.testRun.findFirst({ where: { id, projectId }, select: { id: true, name: true, status: true } });
  if (!existing) return null;
  await recordActivity({ projectId, entityType: 'TestRun', entityId: id, action: 'DELETED', beforeValue: existing });
  await db.testRun.delete({ where: { id } });
  return { deleted: 1 };
}

export async function addTestCasesToRun(projectId: string, testRunId: string, testCaseIds: string[], assignedTo?: string | null) {
  return db.$transaction(async tx => {
    await assertTestRun(tx, projectId, testRunId);
    const testCases = await tx.testCase.findMany({ where: { projectId, id: { in: testCaseIds } }, select: { id: true } });
    if (testCases.length !== testCaseIds.length) throw new Error('Satu atau lebih testcase tidak ditemukan pada project ini.');

    const existing = await tx.testRunCase.findMany({
      where: { testRunId, testCaseId: { in: testCaseIds } },
      select: { testCaseId: true },
    });
    const existingIds = new Set(existing.map(item => item.testCaseId));
    const newTestCaseIds = testCaseIds.filter(testCaseId => !existingIds.has(testCaseId));
    if (newTestCaseIds.length > 0) {
      await tx.testRunCase.createMany({ data: newTestCaseIds.map(testCaseId => ({ testRunId, testCaseId, assignedTo: assignedTo || null })) });
    }
    if (assignedTo !== undefined) await tx.testRunCase.updateMany({ where: { testRunId, testCaseId: { in: testCaseIds } }, data: { assignedTo: assignedTo || null } });
    if (newTestCaseIds.length > 0) {
      await recordActivity({ projectId, entityType: 'TestRun', entityId: testRunId, action: 'CASES_ADDED', afterValue: newTestCaseIds }, tx);
    }
    return { added: newTestCaseIds.length };
  });
}

export async function bulkExecuteTestCases(input: { projectId: string; testRunId: string; testCaseIds: string[]; status: string; tester?: string | null; notes?: string | null }) {
  return db.$transaction(async tx => {
    const run = await assertTestRun(tx, input.projectId, input.testRunId);
    const testCases = await tx.testCase.findMany({ where: { projectId: input.projectId, id: { in: input.testCaseIds } }, select: { id: true, testCaseId: true } });
    if (testCases.length !== input.testCaseIds.length) throw new Error('Satu atau lebih testcase tidak ditemukan pada project ini.');
    const now = new Date();
    const tester = input.tester || run.assignedTo || 'local-user';
    const executions: Array<{ id: string; status: string }> = [];
    for (const testCase of testCases) {
      const membership = await tx.testRunCase.upsert({ where: { testRunId_testCaseId: { testRunId: input.testRunId, testCaseId: testCase.id } }, create: { testRunId: input.testRunId, testCaseId: testCase.id }, update: {} });
      const execution = await tx.testExecution.create({ data: { testRunId: input.testRunId, testCaseId: testCase.id, testRunCaseId: membership.id, tester, status: input.status, notes: input.notes || null, startedAt: now, completedAt: now } });
      await tx.testRunCase.update({ where: { id: membership.id }, data: { latestStatus: input.status, latestExecutionAt: execution.createdAt } });
      await recordActivity({ projectId: input.projectId, entityType: 'TestExecution', entityId: execution.id, action: 'CREATED', afterValue: { testRunId: input.testRunId, testCaseId: testCase.id, status: input.status }, actor: tester }, tx);
      await createExecutionNotification({
        projectId: input.projectId,
        executionId: execution.id,
        testRunId: input.testRunId,
        testCaseId: testCase.id,
        displayId: testCase.testCaseId,
        status: input.status,
      }, tx);
      executions.push({ id: execution.id, status: execution.status });
    }
    return { executed: executions.length, executions };
  });
}

export async function removeTestCaseFromRun(projectId: string, testRunId: string, testCaseId: string) {
  return db.$transaction(async tx => {
    await assertTestRun(tx, projectId, testRunId);
    const membership = await tx.testRunCase.findFirst({ where: { testRunId, testCaseId }, select: { id: true } });
    if (!membership) return { deleted: 0 };
    await tx.testRunCase.delete({ where: { id: membership.id } });
    await recordActivity({ projectId, entityType: 'TestRun', entityId: testRunId, action: 'CASE_REMOVED', afterValue: testCaseId }, tx);
    return { deleted: 1 };
  });
}

export async function createTestExecution(input: {
  projectId: string;
  testRunId: string;
  testCaseId: string;
  bugFixId?: string | null;
  tester?: string | null;
  status?: string;
  actualResult?: string | null;
  notes?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}) {
  return db.$transaction(async tx => {
    const run = await assertTestRun(tx, input.projectId, input.testRunId);
    const testCase = await tx.testCase.findFirst({ where: { id: input.testCaseId, projectId: input.projectId }, select: { id: true, testCaseId: true } });
    if (!testCase) throw new Error('Testcase tidak ditemukan pada project ini.');

    const membership = await tx.testRunCase.upsert({
      where: { testRunId_testCaseId: { testRunId: input.testRunId, testCaseId: input.testCaseId } },
      create: { testRunId: input.testRunId, testCaseId: input.testCaseId },
      update: {},
      select: { id: true },
    });

    const executionStatus = input.status || TEST_EXECUTION_STATUS.NOT_RUN;
    const now = new Date();
    const isCompleted = ![TEST_EXECUTION_STATUS.NOT_RUN, TEST_EXECUTION_STATUS.IN_PROGRESS].includes(executionStatus as never);
    const linkedBug = input.bugFixId
      ? await tx.bugFix.findFirst({ where: { id: input.bugFixId, sourceTestCaseId: input.testCaseId, projectId: input.projectId }, select: { id: true } })
      : [TEST_EXECUTION_STATUS.RETEST, TEST_EXECUTION_STATUS.VERIFIED].includes(executionStatus as never)
        ? await tx.bugFix.findFirst({ where: { sourceTestCaseId: input.testCaseId, projectId: input.projectId, status: { not: 'VERIFIED & FIXED' } }, orderBy: { updatedAt: 'desc' }, select: { id: true } })
        : null;
    if (input.bugFixId && !linkedBug) throw new Error('Bug retest tidak ditemukan untuk testcase ini.');
    const execution = await tx.testExecution.create({
      data: {
        testRunId: input.testRunId,
        testCaseId: input.testCaseId,
        testRunCaseId: membership.id,
        bugFixId: linkedBug?.id || null,
        tester: input.tester || run.assignedTo || 'system',
        status: executionStatus,
        actualResult: input.actualResult || null,
        notes: input.notes || null,
        startedAt: input.startedAt || now,
        completedAt: input.completedAt || (isCompleted ? now : null),
      },
    });
    await tx.testRunCase.update({ where: { id: membership.id }, data: { latestStatus: execution.status, latestExecutionAt: execution.createdAt } });
    await recordActivity({ projectId: input.projectId, entityType: 'TestExecution', entityId: execution.id, action: 'CREATED', afterValue: { testRunId: input.testRunId, testCaseId: input.testCaseId, status: execution.status }, actor: execution.tester }, tx);
    await createExecutionNotification({
      projectId: input.projectId,
      executionId: execution.id,
      testRunId: input.testRunId,
      testCaseId: input.testCaseId,
      displayId: testCase.testCaseId,
      status: execution.status,
    }, tx);
    return execution;
  });
}

export async function updateTestExecution(projectId: string, id: string, data: Record<string, unknown>) {
  const execution = await db.testExecution.findFirst({ where: { id, testRun: { projectId } }, select: { id: true, status: true, notes: true, tester: true, startedAt: true, completedAt: true, testRunCaseId: true } });
  if (!execution) return null;
  const nextStatus = typeof data.status === 'string' ? data.status : execution.status;
  const isCompleted = ![TEST_EXECUTION_STATUS.NOT_RUN, TEST_EXECUTION_STATUS.IN_PROGRESS].includes(nextStatus as never);
  const updateData = {
    ...data,
    ...(data.status !== undefined && !execution.startedAt && { startedAt: new Date() }),
    ...(data.status !== undefined && isCompleted && !execution.completedAt && { completedAt: new Date() }),
  } as Prisma.TestExecutionUncheckedUpdateInput;
  const updated = await db.testExecution.update({ where: { id }, data: updateData });
  if (execution.testRunCaseId && data.status !== undefined) {
    const newer = await db.testExecution.findFirst({
      where: { testRunCaseId: execution.testRunCaseId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (newer?.id === execution.id) await db.testRunCase.update({ where: { id: execution.testRunCaseId }, data: { latestStatus: updated.status, latestExecutionAt: updated.createdAt } });
  }
  for (const field of ['status', 'notes', 'tester'] as const) {
    if (data[field] !== undefined && data[field] !== execution[field]) {
      await recordActivity({ projectId, entityType: 'TestExecution', entityId: id, action: 'UPDATED', field, beforeValue: execution[field], afterValue: data[field] });
    }
  }
  return updated;
}

async function assertTestRun(client: DbClient | TransactionClient, projectId: string, id: string) {
  const run = await client.testRun.findFirst({ where: { id, projectId }, select: { id: true, assignedTo: true } });
  if (!run) throw new Error('Test Run tidak ditemukan pada project ini.');
  return run;
}

function summarizeStatuses(statuses: string[]) {
  return {
    total: statuses.length,
    completed: statuses.filter(status => ![TEST_EXECUTION_STATUS.NOT_RUN, TEST_EXECUTION_STATUS.IN_PROGRESS].includes(status as never)).length,
    passed: statuses.filter(status => status === TEST_EXECUTION_STATUS.PASSED || status === TEST_EXECUTION_STATUS.VERIFIED).length,
    failed: statuses.filter(status => status === TEST_EXECUTION_STATUS.FAILED).length,
    blocked: statuses.filter(status => status === TEST_EXECUTION_STATUS.BLOCKED).length,
    notRun: statuses.filter(status => status === TEST_EXECUTION_STATUS.NOT_RUN).length,
  };
}

export async function createExecutionNotification(input: {
  projectId: string;
  executionId: string;
  testRunId: string;
  testCaseId: string;
  displayId: string;
  status: string;
}, client: TransactionClient) {
  const config = input.status === TEST_EXECUTION_STATUS.FAILED
    ? { severity: 'critical' as const, type: 'TESTCASE_FAILED', title: `${input.displayId} gagal`, message: 'Execution gagal dan membutuhkan investigasi atau pembuatan bug.' }
    : input.status === TEST_EXECUTION_STATUS.BLOCKED
      ? { severity: 'warning' as const, type: 'TESTCASE_BLOCKED', title: `${input.displayId} terblokir`, message: 'Execution tidak dapat dilanjutkan karena blocker.' }
      : input.status === TEST_EXECUTION_STATUS.RETEST
        ? { severity: 'info' as const, type: 'RETEST_READY', title: `${input.displayId} siap retest`, message: 'Testcase masuk antrean retest.' }
        : null;
  if (!config) return;
  await createNotification({
    projectId: input.projectId,
    ...config,
    entityType: 'TestCase',
    entityId: input.testCaseId,
    metadata: { tab: 'testRuns', testRunId: input.testRunId, executionId: input.executionId },
    dedupeKey: `${config.type.toLowerCase()}:${input.executionId}`,
  }, client);
}
