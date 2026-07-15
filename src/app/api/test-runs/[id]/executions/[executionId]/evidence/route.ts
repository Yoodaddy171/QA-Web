import { db } from '@/lib/db';
import { recordActivity } from '@/lib/services/activity-history-service';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'application/pdf']);
const STORAGE_ROOT = path.resolve(process.env.QA_RUNTIME_DIR || path.join(process.cwd(), 'data', 'evidence'), 'execution-evidence');

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

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

  const evidence = await db.testExecutionEvidence.findMany({ where: { executionId }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ evidence });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; executionId: string }> }) {
  const { id, executionId } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return errorResponse('projectId wajib diisi.');
  const execution = await findExecution(projectId, id, executionId);
  if (!execution) return errorResponse('Execution tidak ditemukan.', 404);

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const replaceEvidenceId = String(formData.get('replaceEvidenceId') || '').trim();
    if (!(file instanceof File)) return errorResponse('File evidence wajib dipilih.');
    if (!ALLOWED_MIME_TYPES.has(file.type)) return errorResponse('Tipe file tidak didukung. Gunakan PNG, JPEG, WebP, GIF, MP4, WebM, atau PDF.');
    if (file.size === 0 || file.size > MAX_FILE_SIZE) return errorResponse('Ukuran file harus lebih dari 0 dan maksimal 25 MB.');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160) || 'evidence';
    const evidenceId = crypto.randomUUID();
    const directory = path.join(STORAGE_ROOT, executionId);
    const storagePath = path.join(directory, `${evidenceId}-${safeName}`);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(storagePath, Buffer.from(await file.arrayBuffer()));

    try {
      const evidence = await db.testExecutionEvidence.create({
        data: { id: evidenceId, executionId, fileName: file.name, mimeType: file.type, sizeBytes: file.size, storagePath },
      });
      await recordActivity({ projectId, entityType: 'TestExecution', entityId: executionId, action: 'EVIDENCE_ADDED', afterValue: { id: evidence.id, fileName: evidence.fileName } });
      if (replaceEvidenceId && replaceEvidenceId !== evidence.id) {
        const previous = await db.testExecutionEvidence.findFirst({ where: { id: replaceEvidenceId, executionId } });
        if (previous) {
          await db.testExecutionEvidence.delete({ where: { id: previous.id } });
          await fs.rm(previous.storagePath, { force: true });
          await recordActivity({ projectId, entityType: 'TestExecution', entityId: executionId, action: 'EVIDENCE_REMOVED', beforeValue: { id: previous.id, fileName: previous.fileName }, afterValue: { replacedBy: evidence.id } });
        }
      }
      return NextResponse.json(evidence, { status: 201 });
    } catch (error) {
      await fs.rm(storagePath, { force: true });
      throw error;
    }
  } catch (error) {
    console.error('POST execution evidence error:', error);
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
  await db.testExecutionEvidence.delete({ where: { id: evidence.id } });
  await fs.rm(evidence.storagePath, { force: true });
  await recordActivity({ projectId, entityType: 'TestExecution', entityId: executionId, action: 'EVIDENCE_REMOVED', beforeValue: { id: evidence.id, fileName: evidence.fileName } });
  return NextResponse.json({ deleted: 1 });
}
