import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return NextResponse.json({ error: 'Project wajib diisi.' }, { status: 400 });
  if (!await db.testCase.findFirst({ where: { id, projectId }, select: { id: true } })) return NextResponse.json({ error: 'Testcase tidak ditemukan dalam project ini.' }, { status: 404 });
  const limit = Math.min(50, Math.max(1, Math.floor(Number(req.nextUrl.searchParams.get('limit')) || 25)));
  const cursor = req.nextUrl.searchParams.get('cursor') || undefined;
  const where = { execution: { testCaseId: id, testRun: { projectId } } };
  const [rows, total] = await Promise.all([
    db.testExecutionEvidence.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true, updatedAt: true,
        execution: { select: { id: true, status: true, testRun: { select: { id: true, name: true } } } } },
    }), db.testExecutionEvidence.count({ where }),
  ]);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const items = page.map(({ execution, ...evidence }) => ({ evidence, execution: { id: execution.id, status: execution.status }, run: execution.testRun }));
  return NextResponse.json({ items, total, nextCursor: hasMore ? page.at(-1)?.id || null : null });
}
