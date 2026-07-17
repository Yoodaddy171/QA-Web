import { isTestExecutionStatus } from '@/lib/domain/test-run';
import { createTestExecution, updateTestExecution } from '@/lib/services/test-run-service';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestActor } from '@/lib/request-actor';

const cleanText = (value: unknown) => typeof value === 'string' ? value.trim() : '';

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return errorResponse('projectId wajib diisi.');
  if (!await db.testRun.findFirst({ where: { id, projectId }, select: { id: true } })) return errorResponse('Test Run tidak ditemukan.', 404);
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 50)));
  const cursor = req.nextUrl.searchParams.get('cursor') || undefined;
  const testCaseId = req.nextUrl.searchParams.get('testCaseId') || undefined;
  const rows = await db.testExecution.findMany({
    where: { testRunId: id, ...(testCaseId ? { testCaseId } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const executions = hasMore ? rows.slice(0, limit) : rows;
  return NextResponse.json({ executions, hasMore, nextCursor: hasMore ? executions.at(-1)?.id || null : null });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const actor = await getRequestActor();
    if (!actor) return errorResponse('Authentication required.', 401);
    const body = await req.json();
    const projectId = cleanText(body.projectId);
    const testCaseId = cleanText(body.testCaseId);
    const status = body.status || 'NOT RUN';
    if (!projectId || !testCaseId) return errorResponse('projectId dan testcase wajib diisi.');
    if (!isTestExecutionStatus(status)) return errorResponse('Status execution tidak valid.');

    const execution = await createTestExecution({
      projectId,
      testRunId: id,
      testCaseId,
      tester: actor.name,
      status,
      actualResult: cleanText(body.actualResult) || null,
      notes: cleanText(body.notes) || null,
      startedAt: parseDate(body.startedAt),
      completedAt: parseDate(body.completedAt),
    });
    return NextResponse.json(execution, { status: 201 });
  } catch (error) {
    console.error('POST /api/test-runs/[id]/executions error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Gagal membuat execution.', 500);
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: testRunId } = await context.params;
  try {
    const body = await req.json();
    const projectId = cleanText(body.projectId);
    const executionId = cleanText(body.executionId);
    if (!projectId || !executionId) return errorResponse('projectId dan executionId wajib diisi.');
    if (body.status !== undefined && !isTestExecutionStatus(body.status)) return errorResponse('Status execution tidak valid.');

    if (!await db.testExecution.findFirst({ where: { id: executionId, testRunId, testRun: { projectId } }, select: { id: true } })) return errorResponse('Execution tidak ditemukan.', 404);

    const execution = await updateTestExecution(projectId, executionId, {
      ...(body.tester !== undefined && { tester: cleanText(body.tester) || null }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.actualResult !== undefined && { actualResult: cleanText(body.actualResult) || null }),
      ...(body.notes !== undefined && { notes: cleanText(body.notes) || null }),
      ...(body.startedAt !== undefined && { startedAt: parseDate(body.startedAt) }),
      ...(body.completedAt !== undefined && { completedAt: parseDate(body.completedAt) }),
    });
    if (!execution) return errorResponse('Execution tidak ditemukan.', 404);
    return NextResponse.json(execution);
  } catch (error) {
    console.error('PUT /api/test-runs/[id]/executions error:', error);
    return errorResponse('Gagal mengubah execution.', 500);
  }
}
