import { isTestExecutionStatus } from '@/lib/domain/test-run';
import { bulkExecuteTestCases } from '@/lib/services/test-run-service';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestActor } from '@/lib/request-actor';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const actor = await getRequestActor();
    if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const body = await req.json();
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const rawTestCaseIds: string[] = Array.isArray(body.testCaseIds)
      ? body.testCaseIds.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())).map((value: string) => value.trim())
      : [];
    const testCaseIds = Array.from(new Set<string>(rawTestCaseIds));
    const status = typeof body.status === 'string' ? body.status : '';
    if (!projectId || !testCaseIds.length) return NextResponse.json({ error: 'projectId dan testcase wajib diisi.' }, { status: 400 });
    if (!isTestExecutionStatus(status)) return NextResponse.json({ error: 'Status execution tidak valid.' }, { status: 400 });
    const result = await bulkExecuteTestCases({ projectId, testRunId: id, testCaseIds, status, tester: actor.name, notes: typeof body.notes === 'string' ? body.notes.trim() || null : null });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal menjalankan testcase secara bulk.' }, { status: 500 });
  }
}
