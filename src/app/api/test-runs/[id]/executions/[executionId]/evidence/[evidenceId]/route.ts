import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { evidenceStorage } from '@/lib/storage/evidence-storage';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; executionId: string; evidenceId: string }> }) {
  const { id, executionId, evidenceId } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });

  const evidence = await db.testExecutionEvidence.findFirst({
    where: { id: evidenceId, executionId, execution: { testRunId: id, testRun: { projectId } } },
  });
  if (!evidence) return NextResponse.json({ error: 'Evidence tidak ditemukan.' }, { status: 404 });

  try {
    const file = await evidenceStorage.read(evidence.storagePath);
    const inlineSafe = ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'].includes(evidence.mimeType);
    const safeName = evidence.fileName.replace(/["\r\n]/g, '_');
    return new NextResponse(file, { headers: {
      'Content-Type': evidence.mimeType,
      'Content-Length': String(evidence.sizeBytes),
      'Content-Disposition': `${inlineSafe ? 'inline' : 'attachment'}; filename="${safeName}"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    } });
  } catch {
    return NextResponse.json({ error: 'File evidence tidak ditemukan di storage.' }, { status: 404 });
  }
}
