import type { Prisma, TestExecution } from '@prisma/client';
import { getProgressFromStatus } from '@/lib/domain/progress';
import { syncBugFixForTestCaseStatus } from './bugfix-sync-service';
import { recordActivity } from './activity-history-service';
import { MutationError, nextMutationTime } from './mutation-error';

export async function resolveExecutionTestCase(client: Prisma.TransactionClient, projectId: string, reference: string) {
  const rows = await client.testCase.findMany({ where: { projectId, OR: [{ id: reference }, { testCaseId: reference }] }, select: { id: true, testCaseId: true }, take: 2 });
  if (!rows.length) throw new MutationError(404, 'Testcase tidak ditemukan pada project ini.');
  if (rows.length > 1) throw new MutationError(409, 'ID testcase ambigu: cocok dengan ID internal dan ID tampilan yang berbeda. Gunakan ID internal yang tidak ambigu.');
  return rows[0];
}

// Effective result time, then recording order, defines latest across all runs.
// Explicit historical completedAt/startedAt never wins merely because it was imported today.
function newerThan(execution: TestExecution): Prisma.TestExecutionWhereInput {
  const at = execution.completedAt ?? execution.startedAt ?? execution.createdAt;
  return { id: { not: execution.id }, OR: [
    { completedAt: { gt: at } },
    { completedAt: null, startedAt: { gt: at } },
    { completedAt: null, startedAt: null, createdAt: { gt: at } },
    { AND: [
      { OR: [{ completedAt: at }, { completedAt: null, startedAt: at }, { completedAt: null, startedAt: null, createdAt: at }] },
      { OR: [{ createdAt: { gt: execution.createdAt } }, { createdAt: execution.createdAt, id: { gt: execution.id } }] },
    ] },
  ] };
}

export interface ExecutionCaseSync {
  previousStatus: string;
  status: string;
  actualResult: string | null;
  applied: boolean;
  reason: string;
  warning?: string;
}

export async function synchronizeExecutionResult(client: Prisma.TransactionClient, execution: TestExecution, projectId: string): Promise<ExecutionCaseSync> {
  if (execution.testRunCaseId) {
    const newerInRun = await client.testExecution.findFirst({ where: { testRunCaseId: execution.testRunCaseId, ...newerThan(execution) }, select: { id: true } });
    if (!newerInRun) await client.testRunCase.update({ where: { id: execution.testRunCaseId }, data: { latestStatus: execution.status, latestExecutionAt: execution.completedAt ?? execution.startedAt ?? execution.createdAt } });
  }
  const current = await client.testCase.findFirstOrThrow({ where: { id: execution.testCaseId, projectId } });
  const mapping: Record<string, { status: string; actualResult: string }> = {
    PASSED: { status: 'DONE', actualResult: 'As Expected' },
    VERIFIED: { status: 'DONE', actualResult: 'As Expected' },
    FAILED: { status: 'FAILED', actualResult: 'Not As Expected' },
    BLOCKED: { status: 'BLOCKED', actualResult: '-' },
    'IN PROGRESS': { status: 'IN PROGRESS', actualResult: '-' },
    RETEST: { status: 'READY TO RETEST', actualResult: '-' },
  };
  const result = mapping[execution.status];
  const snapshot = { previousStatus: current.status, status: current.status, actualResult: current.actualResult };
  if (!result) return { ...snapshot, applied: false, reason: 'NO_VERDICT', warning: 'Execution dicatat tanpa verdict; status testcase dipertahankan.' };
  const newer = await client.testExecution.findFirst({ where: { testCaseId: execution.testCaseId, status: { not: 'NOT RUN' }, ...newerThan(execution) }, select: { id: true } });
  if (newer) return { ...snapshot, applied: false, reason: 'HISTORICAL_EXECUTION', warning: 'Execution historis dicatat; status testcase mengikuti execution yang lebih baru.' };
  const changed = current.status !== result.status || current.actualResult !== result.actualResult;
  if (changed) {
    const claimed = await client.testCase.updateMany({ where: { id: current.id, updatedAt: current.updatedAt }, data: { ...result, progress: getProgressFromStatus(result.status), updatedAt: nextMutationTime(current.updatedAt) } });
    if (claimed.count !== 1) throw new MutationError(409, 'Testcase telah berubah. Muat ulang sebelum mencatat hasil lagi.');
    await recordActivity({ projectId, entityType: 'TestCase', entityId: current.id, action: 'UPDATED', field: 'status', beforeValue: { status: current.status, actualResult: current.actualResult }, afterValue: { ...result, sourceExecutionId: execution.id }, actor: execution.tester }, client);
  }
  await syncBugFixForTestCaseStatus({ client, sourceTestCaseId: current.id, source: current, finalStatus: result.status, finalActualResult: result.actualResult });
  return { ...snapshot, ...result, applied: changed, reason: changed ? 'LATEST_EXECUTION' : 'ALREADY_SYNCHRONIZED' };
}
