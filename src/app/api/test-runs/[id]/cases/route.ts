import { addTestCasesToRun, getTestRun, removeTestCaseFromRun } from '@/lib/services/test-run-service';
import { NextRequest, NextResponse } from 'next/server';

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return errorResponse('projectId wajib diisi.');

  const testRun = await getTestRun(projectId, id);
  if (!testRun) return errorResponse('Test Run tidak ditemukan.', 404);
  return NextResponse.json({ testCases: testRun.testCases, progress: testRun.progress, summary: testRun.summary });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = await req.json();
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const rawTestCaseIds: unknown[] = Array.isArray(body.testCaseIds) ? body.testCaseIds : [];
    const testCaseIds: string[] = rawTestCaseIds
      .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value: string) => value.trim());
    if (!projectId) return errorResponse('projectId wajib diisi.');
    if (testCaseIds.length === 0) return errorResponse('Minimal satu testcase wajib dipilih.');

    return NextResponse.json(await addTestCasesToRun(projectId, id, [...new Set(testCaseIds)], typeof body.assignedTo === 'string' ? body.assignedTo.trim() : undefined), { status: 201 });
  } catch (error) {
    console.error('POST /api/test-runs/[id]/cases error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Gagal menambahkan testcase ke Test Run.', 500);
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  const testCaseId = req.nextUrl.searchParams.get('testCaseId')?.trim();
  if (!projectId || !testCaseId) return errorResponse('projectId dan testCaseId wajib diisi.');
  return NextResponse.json(await removeTestCaseFromRun(projectId, id, testCaseId));
}
