import { isTestRunStatus } from '@/lib/domain/test-run';
import { deleteTestRun, getTestRun, updateTestRun } from '@/lib/services/test-run-service';
import { NextRequest, NextResponse } from 'next/server';

const cleanText = (value: unknown) => typeof value === 'string' ? value.trim() : '';

function parseDate(value: unknown) {
  if (value === null || value === '') return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return errorResponse('projectId wajib diisi.');

  const testRun = await getTestRun(projectId, id);
  if (!testRun) return errorResponse('Test Run tidak ditemukan.', 404);
  return NextResponse.json(testRun);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = await req.json();
    const projectId = cleanText(body.projectId);
    const name = body.name === undefined ? undefined : cleanText(body.name);
    const status = body.status;
    if (!projectId) return errorResponse('Project wajib diisi.');
    if (name !== undefined && !name) return errorResponse('Nama Test Run wajib diisi.');
    if (status !== undefined && !isTestRunStatus(status)) return errorResponse('Status Test Run tidak valid.');
    const testPlanId = body.testPlanId === undefined ? undefined : cleanText(body.testPlanId) || null;
    if (testPlanId && !await (await import('@/lib/db')).db.testPlan.findFirst({ where: { id: testPlanId, projectId }, select: { id: true } })) return errorResponse('Test Plan tidak ditemukan pada project ini.', 404);

    const testRun = await updateTestRun(projectId, id, {
      ...(name !== undefined && { name }),
      ...(body.description !== undefined && { description: cleanText(body.description) || null }),
      ...(status !== undefined && { status }),
      ...(testPlanId !== undefined && { testPlanId }),
      ...(body.startDate !== undefined && { startDate: parseDate(body.startDate) }),
      ...(body.endDate !== undefined && { endDate: parseDate(body.endDate) }),
      ...(body.assignedTo !== undefined && { assignedTo: cleanText(body.assignedTo) || null }),
    });
    if (!testRun) return errorResponse('Test Run tidak ditemukan.', 404);
    return NextResponse.json(testRun);
  } catch (error) {
    console.error('PUT /api/test-runs/[id] error:', error);
    return errorResponse('Gagal mengubah Test Run.', 500);
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return errorResponse('projectId wajib diisi.');

  const result = await deleteTestRun(projectId, id);
  if (!result) return errorResponse('Test Run tidak ditemukan.', 404);
  return NextResponse.json(result);
}
