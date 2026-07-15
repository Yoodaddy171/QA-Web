import { db } from '@/lib/db';
import { TESTCASE_ACTUAL_RESULT, TESTCASE_STATUS } from '@/lib/domain/testcase';
import { syncBugFixForTestCaseStatus } from '@/lib/services/bugfix-sync-service';
import { recordActivity } from '@/lib/services/activity-history-service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; executionId: string }> }) {
  const { id, executionId } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });

  try {
    const result = await db.$transaction(async tx => {
      const execution = await tx.testExecution.findFirst({
        where: { id: executionId, testRunId: id, testRun: { projectId } },
        select: { id: true, testCaseId: true, status: true, notes: true },
      });
      if (!execution) throw new Error('Execution tidak ditemukan.');
      if (execution.status !== 'FAILED') throw new Error('Bug hanya dapat dibuat dari execution FAILED.');

      const testCase = await tx.testCase.findFirst({ where: { id: execution.testCaseId, projectId } });
      if (!testCase) throw new Error('Testcase tidak ditemukan.');

      await tx.testCase.update({
        where: { id: testCase.id },
        data: { status: TESTCASE_STATUS.FAILED, actualResult: TESTCASE_ACTUAL_RESULT.NOT_AS_EXPECTED, progress: 0 },
      });
      await syncBugFixForTestCaseStatus({
        client: tx,
        sourceTestCaseId: testCase.id,
        source: testCase,
        finalStatus: TESTCASE_STATUS.FAILED,
        finalActualResult: TESTCASE_ACTUAL_RESULT.NOT_AS_EXPECTED,
      });

      const bug = await tx.bugFix.findFirst({ where: { sourceTestCaseId: testCase.id, projectId, status: { not: 'VERIFIED & FIXED' } }, orderBy: { updatedAt: 'desc' } });
      if (!bug) throw new Error('Bug gagal dibuat dari execution.');
      const linkedBug = bug.sourceExecutionId === execution.id
        ? bug
        : await tx.bugFix.update({ where: { id: bug.id }, data: { sourceExecutionId: execution.id } });
      await recordActivity({ projectId, entityType: 'BugFix', entityId: linkedBug.id, action: 'CREATED_FROM_EXECUTION', afterValue: { executionId: execution.id, testRunId: id } }, tx);
      return linkedBug;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST /api/test-runs/[id]/executions/[executionId]/bug error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal membuat bug dari execution.' }, { status: 400 });
  }
}
