import { db } from '@/lib/db';
import { isTestRunStatus, TEST_RUN_STATUS } from '@/lib/domain/test-run';
import { createTestRun, listTestRuns } from '@/lib/services/test-run-service';
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

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return errorResponse('projectId wajib diisi.');

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return errorResponse('Project tidak ditemukan.', 404);

  try {
    const page = await listTestRuns(projectId, {
      cursor: req.nextUrl.searchParams.get('cursor') || undefined,
      limit: Number(req.nextUrl.searchParams.get('limit') || 25),
    });
    return NextResponse.json({ testRuns: page.items, hasMore: page.hasMore, nextCursor: page.nextCursor });
  } catch (error) {
    console.error('GET /api/test-runs error:', error);
    return errorResponse('Gagal memuat Test Run.', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor) return errorResponse('Authentication required.', 401);
    const body = await req.json();
    const projectId = cleanText(body.projectId);
    const name = cleanText(body.name);
    const status = body.status || TEST_RUN_STATUS.DRAFT;
    if (!projectId) return errorResponse('Project wajib dipilih.');
    if (!name) return errorResponse('Nama Test Run wajib diisi.');
    if (!isTestRunStatus(status)) return errorResponse('Status Test Run tidak valid.');

    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return errorResponse('Project tidak ditemukan.', 404);
    const testPlanId = cleanText(body.testPlanId) || null;
    if (testPlanId && !await db.testPlan.findFirst({ where: { id: testPlanId, projectId }, select: { id: true } })) return errorResponse('Test Plan tidak ditemukan pada project ini.', 404);

    const testRun = await createTestRun({
      projectId,
      name,
      description: cleanText(body.description) || null,
      status,
      testPlanId,
      startDate: parseDate(body.startDate),
      endDate: parseDate(body.endDate),
      createdBy: actor.name,
      assignedTo: cleanText(body.assignedTo) || null,
    });
    return NextResponse.json(testRun, { status: 201 });
  } catch (error) {
    console.error('POST /api/test-runs error:', error);
    return errorResponse('Gagal membuat Test Run.', 500);
  }
}
