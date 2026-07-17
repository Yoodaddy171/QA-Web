import { db } from '@/lib/db';
import { recordActivity } from '@/lib/services/activity-history-service';
import { NextRequest, NextResponse } from 'next/server';
import { createNotification } from '@/lib/services/notification-service';
import { evidenceStorage } from '@/lib/storage/evidence-storage';
import { MAX_EVIDENCE_FILE_SIZE, validateEvidenceFile } from '@/lib/storage/evidence-file-validation';


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

  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_EVIDENCE_FILE_SIZE + 1024 * 1024) return errorResponse('Request upload melebihi batas 25 MB.', 413);
    const formData = await req.formData();
    const file = formData.get('file');
    const replaceEvidenceId = String(formData.get('replaceEvidenceId') || '').trim();
    if (!(file instanceof File)) return errorResponse('File evidence wajib dipilih.');
    let detectedMime: string;
    try {
      detectedMime = await validateEvidenceFile(file);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Evidence tidak valid.');
    }
    const [projectUsage, globalUsage] = await Promise.all([
      db.testExecutionEvidence.aggregate({
        where: { execution: { testRun: { projectId } } },
        _sum: { sizeBytes: true },
      }),
      db.testExecutionEvidence.aggregate({ _sum: { sizeBytes: true } }),
    ]);
    if ((projectUsage._sum.sizeBytes || 0) + file.size > PROJECT_QUOTA_BYTES) return errorResponse('Quota evidence project sudah penuh.', 413);
    if ((globalUsage._sum.sizeBytes || 0) + file.size > GLOBAL_QUOTA_BYTES) return errorResponse('Quota evidence global sudah penuh.', 413);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160) || 'evidence';
    const evidenceId = crypto.randomUUID();
    const stored = await evidenceStorage.put(
      file.stream(),
      `${projectId}/${executionId}/${evidenceId}-${safeName}`,
      MAX_EVIDENCE_FILE_SIZE,
    );

    try {
      const evidence = await db.testExecutionEvidence.create({
        data: {
          id: evidenceId,
          executionId,
          fileName: file.name,
          mimeType: detectedMime,
          sizeBytes: stored.size,
          storagePath: stored.key,
          sha256: stored.hash,
        },
        select: { id: true, executionId: true, fileName: true, mimeType: true, sizeBytes: true, sha256: true, createdAt: true, updatedAt: true },
      });
      await recordActivity({ projectId, entityType: 'TestExecution', entityId: executionId, action: 'EVIDENCE_ADDED', afterValue: { id: evidence.id, fileName: evidence.fileName } });
      if (replaceEvidenceId && replaceEvidenceId !== evidence.id) {
        const previous = await db.testExecutionEvidence.findFirst({ where: { id: replaceEvidenceId, executionId } });
        if (previous) {
          await evidenceStorage.delete(previous.storagePath);
          await db.testExecutionEvidence.delete({ where: { id: previous.id } });
          await recordActivity({ projectId, entityType: 'TestExecution', entityId: executionId, action: 'EVIDENCE_REMOVED', beforeValue: { id: previous.id, fileName: previous.fileName }, afterValue: { replacedBy: evidence.id } });
        }
      }
      return NextResponse.json(evidence, { status: 201 });
    } catch (error) {
      await evidenceStorage.delete(stored.key);
      throw error;
    }
  } catch (error) {
    console.error('POST execution evidence error:', error);
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
    return errorResponse('Gagal menyimpan evidence.', 500);
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
