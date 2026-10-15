import { db } from '@/lib/db';
import { BUGFIX_STATUS, canTransitionBugFixStatus, isEditableBugFixStatus } from '@/lib/domain/bugfix';
import { TESTCASE_ACTUAL_RESULT, TESTCASE_STATUS } from '@/lib/domain/testcase';
import { getProgressFromStatus } from '@/lib/domain/progress';
import { recordActivity } from './activity-history-service';
import { MutationError, nextMutationTime } from './mutation-error';
import type { Prisma } from '@prisma/client';

export async function updateBugFixStatus(id: string, status: unknown) {
  const current = await db.bugFix.findUnique({ where: { id } });
  if (!current) throw new MutationError(404, 'Bug fix item not found');
  if (status !== undefined && !isEditableBugFixStatus(status)) {
    throw new MutationError(400, 'Bug fix hanya bisa diproses sampai READY TO RETEST. Verified & Fixed dilakukan dari halaman Test Case setelah retest berhasil.');
  }
  const target = status === undefined ? current.status : String(status);
  if (!canTransitionBugFixStatus(current.status, target)) {
    throw new MutationError(400, 'Status bug fix hanya bisa berpindah satu tahap. Tidak boleh melompati tahap.');
  }

  return db.$transaction(async tx => {
    const source = await tx.testCase.findUnique({ where: { id: current.sourceTestCaseId } });
    if (!source) throw new MutationError(404, 'Original test case tidak ditemukan. Bug fix ini tidak bisa diperbarui.');
    if (source.projectId !== current.projectId) throw new MutationError(409, 'Relasi Bug dan Test Case tidak berada dalam project yang sama.');

    const expected = { id, projectId: current.projectId, status: current.status, updatedAt: current.updatedAt };
    if (target === current.status) {
      const unchanged = await tx.bugFix.findFirst({ where: expected, include: { module: true } });
      if (!unchanged) throw new MutationError(409, 'Status bug telah berubah. Muat ulang data sebelum mencoba lagi.');
      return unchanged;
    }

    const now = nextMutationTime(current.updatedAt);
    const data: Prisma.BugFixUpdateManyMutationInput = { status: target, updatedAt: now };
    if (target === BUGFIX_STATUS.REPORTED && !current.reportedAt) data.reportedAt = now;
    if (target === BUGFIX_STATUS.FIXING) data.fixingAt = now;
    if (target === BUGFIX_STATUS.READY_TO_RETEST) data.readyAt = now;
    const claimed = await tx.bugFix.updateMany({ where: expected, data });
    if (claimed.count !== 1) throw new MutationError(409, 'Status bug telah berubah. Muat ulang data sebelum mencoba lagi.');

    const bounce = current.status === BUGFIX_STATUS.READY_TO_RETEST && target === BUGFIX_STATUS.FIXING
      && source.status === TESTCASE_STATUS.READY_TO_RETEST;
    if (target === BUGFIX_STATUS.READY_TO_RETEST || bounce) {
      const nextStatus = bounce ? TESTCASE_STATUS.FAILED : TESTCASE_STATUS.READY_TO_RETEST;
      const nextActual = bounce ? TESTCASE_ACTUAL_RESULT.NOT_AS_EXPECTED : source.actualResult;
      const synced = await tx.testCase.updateMany({
        where: { id: source.id, projectId: current.projectId, status: source.status, updatedAt: source.updatedAt },
        data: { status: nextStatus, actualResult: nextActual, progress: getProgressFromStatus(nextStatus), updatedAt: nextMutationTime(source.updatedAt) },
      });
      if (synced.count !== 1) throw new MutationError(409, 'Test Case telah berubah. Muat ulang data sebelum mencoba lagi.');
      for (const [field, beforeValue, afterValue] of [
        ['status', source.status, nextStatus], ['actualResult', source.actualResult, nextActual],
      ] as const) {
        if (beforeValue !== afterValue) await recordActivity({ projectId: source.projectId, entityType: 'TestCase', entityId: source.id, action: 'UPDATED', field, beforeValue, afterValue }, tx);
      }
    }
    await recordActivity({ projectId: current.projectId, entityType: 'BugFix', entityId: id, action: 'UPDATED', field: 'status', beforeValue: current.status, afterValue: target }, tx);
    return tx.bugFix.findUniqueOrThrow({ where: { id }, include: { module: true } });
  }, { isolationLevel: 'Serializable' });
}
