import { db } from '@/lib/db';
import { recordActivity } from '@/lib/services/activity-history-service';
import { NextRequest, NextResponse } from 'next/server';
import { createNotification } from '@/lib/services/notification-service';
import { evidenceStorage } from '@/lib/storage/evidence-storage';
import { MAX_EVIDENCE_FILE_SIZE, validateEvidenceFile } from '@/lib/storage/evidence-file-validation';
import { MutationError, mutationFailure } from '@/lib/services/mutation-error';
import type { TestExecutionEvidence } from '@prisma/client';
import { getRequestActor } from '@/lib/request-actor';


function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const PROJECT_QUOTA_BYTES = Number(process.env.QA_EVIDENCE_PROJECT_QUOTA_MB || 1024) * 1024 * 1024;
const GLOBAL_QUOTA_BYTES = Number(process.env.QA_EVIDENCE_GLOBAL_QUOTA_MB || 5120) * 1024 * 1024;

async function findExecution(projectId: string, testRunId: string, executionId: string) {
  return db.testExecution.findFirst({
    where: { id: executionId, testRunId, testRun: { projectId } },
    select: { id: true, testRunId: true, testCaseId: true, testRun: { select: { projectId: true } } },
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; executionId: string }> }) {
  const { id, executionId } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return errorResponse('projectId wajib diisi.');
  const execution = await findExecution(projectId, id, executionId);
  if (!execution) return errorResponse('Execution tidak ditemukan.', 404);

  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 50)));
  const cursor = req.nextUrl.searchParams.get('cursor') || undefined;
  const rows = await db.testExecutionEvidence.findMany({
    where: { executionId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, executionId: true, fileName: true, mimeType: true, sizeBytes: true, sha256: true, createdAt: true, updatedAt: true },
  });
  const hasMore = rows.length > limit;
  const evidence = hasMore ? rows.slice(0, limit) : rows;
  return NextResponse.json({ evidence, hasMore, nextCursor: hasMore ? evidence.at(-1)?.id || null : null });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; executionId: string }> }) {
  const { id, executionId } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return errorResponse('projectId wajib diisi.');
  const execution = await findExecution(projectId, id, executionId);
  if (!execution) return errorResponse('Execution tidak ditemukan.', 404);

  const staged: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; storagePath: string; sha256: string }> = [];
  let committed = false;
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_EVIDENCE_FILE_SIZE + 1024 * 1024) return errorResponse('Request upload melebihi batas 25 MB.', 413);
    const formData = await req.formData();
    const files = formData.getAll('file');
    const replaceEvidenceId = String(formData.get('replaceEvidenceId') || '').trim();
    if (replaceEvidenceId && (await getRequestActor())?.guest) return errorResponse('Tamu hanya dapat menambah evidence baru, bukan mengganti evidence.', 403);
    if (!files.length || files.some(file => !(file instanceof File))) return errorResponse('File evidence wajib dipilih.');
    if (files.length > 20) return errorResponse('Maksimal 20 file evidence per request.');
    if (replaceEvidenceId && files.length !== 1) return errorResponse('Penggantian evidence hanya menerima satu file.');
    const uploads: Array<{ file: File; mimeType: string }> = [];
    try {
      for (const file of files as File[]) uploads.push({ file, mimeType: await validateEvidenceFile(file) });
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Evidence tidak valid.');
    }
    const totalBytes = uploads.reduce((total, { file }) => total + file.size, 0);
    if (totalBytes > MAX_EVIDENCE_FILE_SIZE) return errorResponse('Total upload melebihi batas 25 MB per request.', 413);
    // Validate the complete batch before writing any file. Metadata/activity commit together.
    for (const { file, mimeType } of uploads) {
      const id = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160) || 'evidence';
      const stored = await evidenceStorage.put(file.stream(), `${projectId}/${executionId}/${id}-${safeName}`, MAX_EVIDENCE_FILE_SIZE);
      staged.push({ id, fileName: file.name, mimeType, sizeBytes: stored.size, storagePath: stored.key, sha256: stored.hash });
    }
    const saved = await db.$transaction(async tx => {
      const previous = replaceEvidenceId ? await tx.testExecutionEvidence.findFirst({ where: { id: replaceEvidenceId, executionId } }) : null;
      if (replaceEvidenceId && !previous) throw new MutationError(404, 'Evidence pengganti tidak ditemukan pada execution ini.');
      const [projectUsage, globalUsage] = await Promise.all([
        tx.testExecutionEvidence.aggregate({ where: { execution: { testRun: { projectId } } }, _sum: { sizeBytes: true } }),
        tx.testExecutionEvidence.aggregate({ _sum: { sizeBytes: true } }),
      ]);
      if ((projectUsage._sum.sizeBytes || 0) + totalBytes - (previous?.sizeBytes || 0) > PROJECT_QUOTA_BYTES) throw new Error('Quota evidence project sudah penuh.');
      if ((globalUsage._sum.sizeBytes || 0) + totalBytes - (previous?.sizeBytes || 0) > GLOBAL_QUOTA_BYTES) throw new Error('Quota evidence global sudah penuh.');
      const evidence: Array<Omit<TestExecutionEvidence, 'storagePath'>> = [];
      for (const item of staged) {
        const row = await tx.testExecutionEvidence.create({ data: { ...item, executionId },
          select: { id: true, executionId: true, fileName: true, mimeType: true, sizeBytes: true, sha256: true, createdAt: true, updatedAt: true } });
        await recordActivity({ projectId, entityType: 'TestExecution', entityId: executionId, action: 'EVIDENCE_ADDED', afterValue: { id: row.id, fileName: row.fileName } }, tx);
        evidence.push(row);
      }
      if (previous) {
        await tx.testExecutionEvidence.delete({ where: { id: previous.id } });
        await recordActivity({ projectId, entityType: 'TestExecution', entityId: executionId, action: 'EVIDENCE_REMOVED', beforeValue: { id: previous.id, fileName: previous.fileName }, afterValue: { replacedBy: evidence[0].id } }, tx);
      }
      return { evidence, previous };
    }, { isolationLevel: 'Serializable' });
    committed = true;
    if (saved.previous) {
      // A storage cleanup failure must not claim that the committed upload failed.
      await evidenceStorage.delete(saved.previous.storagePath).catch(() => console.warn('Replaced evidence file cleanup pending.'));
    }
    return NextResponse.json(saved.evidence.length === 1 ? saved.evidence[0] : { evidence: saved.evidence, uploadedCount: saved.evidence.length }, { status: 201 });
  } catch (error) {
    if (!committed) await Promise.allSettled(staged.map(item => evidenceStorage.delete(item.storagePath)));
    if (error instanceof Error && /^Quota evidence/.test(error.message)) return errorResponse(error.message, 413);
    const failure = mutationFailure(error, 'POST execution evidence', 'Gagal menyimpan evidence.');
    await createNotification({
      projectId,
      type: 'EVIDENCE_UPLOAD_FAILED',
      severity: 'critical',
      title: 'Upload evidence gagal',
      message: 'Evidence tidak berhasil disimpan. Coba ulangi upload.',
      entityType: 'TestExecution',
      entityId: executionId,
      metadata: { tab: 'testRuns', testRunId: id },
      dedupeKey: `evidence-upload-failed:${executionId}:${Date.now()}`,
    }).catch(() => undefined);
    return errorResponse(failure.error, failure.status);
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; executionId: string }> }) {
  const { id, executionId } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  const evidenceId = req.nextUrl.searchParams.get('evidenceId')?.trim();
  if (!projectId || !evidenceId) return errorResponse('projectId dan evidenceId wajib diisi.');
  const execution = await findExecution(projectId, id, executionId);
  if (!execution) return errorResponse('Execution tidak ditemukan.', 404);

  const evidence = await db.testExecutionEvidence.findFirst({ where: { id: evidenceId, executionId } });
  if (!evidence) return errorResponse('Evidence tidak ditemukan.', 404);
  await evidenceStorage.delete(evidence.storagePath);
  await db.testExecutionEvidence.delete({ where: { id: evidence.id } });
  await recordActivity({ projectId, entityType: 'TestExecution', entityId: executionId, action: 'EVIDENCE_REMOVED', beforeValue: { id: evidence.id, fileName: evidence.fileName } });
  return NextResponse.json({ deleted: 1 });
}
