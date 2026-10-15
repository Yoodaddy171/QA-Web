import { db } from '@/lib/db';
import { isBugFixStatus } from '@/lib/domain/bugfix';
import { updateBugFixStatus } from '@/lib/services/bugfix-service';
import { mutationFailure } from '@/lib/services/mutation-error';
import { NextRequest, NextResponse } from 'next/server';

const BUGFIX_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'testCaseId', 'page', 'status', 'priority']);

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'Project scope wajib diisi.' }, { status: 400 });
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const page = parsePositiveInt(url.searchParams.get('page'), 1, 100000);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 50, 200);
    const requestedSortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortBy = BUGFIX_SORT_FIELDS.has(requestedSortBy) ? requestedSortBy : 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};
    if (projectId) {
      const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      where.projectId = projectId;
    }
    if (status) {
      if (!isBugFixStatus(status)) return NextResponse.json({ error: 'Status bug fix tidak valid.' }, { status: 400 });
      where.status = status;
    }
    if (search) {
      where.OR = [
        { testCaseId: { contains: search } },
        { page: { contains: search } },
        { subMenu: { contains: search } },
        { testAction: { contains: search } },
      ];
    }

    const total = await db.bugFix.count({ where });
    const bugFixItems = await db.bugFix.findMany({
      where,
      select: {
        id: true,
        sourceTestCaseId: true,
        testCaseId: true,
        projectId: true,
        page: true,
        subMenu: true,
        testType: true,
        testAction: true,
        steps: true,
        expectedResult: true,
        actualResult: true,
        priority: true,
        moduleId: true,
        status: true,
        reportedAt: true,
        fixingAt: true,
        readyAt: true,
        fixedAt: true,
        createdAt: true,
        updatedAt: true,
        module: { select: { id: true, name: true } },
      },
      orderBy: [{ [sortBy]: sortOrder }, { id: sortOrder }],
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({ bugFixItems, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('GET /api/bugfix error:', error);
    return NextResponse.json({ error: 'Failed to fetch bug fix items' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;
    if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const bugFixItem = await updateBugFixStatus(id, status);
    return NextResponse.json(bugFixItem);
  } catch (error) {
    const failure = mutationFailure(error, 'PUT /api/bugfix', 'Failed to update bug fix item');
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const ids = url.searchParams.get('ids');

    if (ids) {
      const idList = ids.split(',').map(item => item.trim()).filter(Boolean);
      if (idList.length === 0) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
      await db.bugFix.deleteMany({ where: { id: { in: idList } } });
      return NextResponse.json({ deleted: idList.length });
    }

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const existing = await db.bugFix.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Bug fix item not found' }, { status: 404 });
    await db.bugFix.delete({ where: { id } });
    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    console.error('DELETE /api/bugfix error:', error);
    return NextResponse.json({ error: 'Failed to delete bug fix item' }, { status: 500 });
  }
}
