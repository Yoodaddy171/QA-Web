import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; executionId: string; evidenceId: string }> }) {
  const { id, executionId, evidenceId } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });

  const evidence = await db.testExecutionEvidence.findFirst({
    where: { id: evidenceId, executionId, execution: { testRunId: id, testRun: { projectId } } },
  });
  if (!evidence) return NextResponse.json({ error: 'Evidence tidak ditemukan.' }, { status: 404 });

  try {
    const file = await fs.readFile(evidence.storagePath);
    return new NextResponse(file, { headers: { 'Content-Type': evidence.mimeType, 'Content-Length': String(evidence.sizeBytes), 'Content-Disposition': `inline; filename="${encodeURIComponent(evidence.fileName)}"`, 'Cache-Control': 'private, max-age=3600' } });
  } catch {
    return NextResponse.json({ error: 'File evidence tidak ditemukan di storage.' }, { status: 404 });
  }
}
