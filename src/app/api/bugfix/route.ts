import { db } from '@/lib/db';
import { BUGFIX_STATUS, isBugFixStatus, isEditableBugFixStatus } from '@/lib/domain/bugfix';
import { getProgressFromStatus } from '@/lib/domain/progress';
import { TESTCASE_STATUS } from '@/lib/domain/testcase';
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
      orderBy: { [sortBy]: sortOrder },
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
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Get current bug fix item
    const current = await db.bugFix.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: 'Bug fix item not found' }, { status: 404 });

    // Update timestamps based on status change
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) {
      if (!isEditableBugFixStatus(data.status)) {
        return NextResponse.json(
          { error: 'Bug fix hanya bisa diproses sampai READY TO RETEST. Verified & Fixed dilakukan dari halaman Test Case setelah retest berhasil.' },
          { status: 400 }
        );
      }

      updateData.status = data.status;
      const now = new Date();

      if (data.status === BUGFIX_STATUS.REPORTED && !current.reportedAt) {
        updateData.reportedAt = now;
      }
      if (data.status === BUGFIX_STATUS.FIXING) {
        updateData.fixingAt = now;
      }
      if (data.status === BUGFIX_STATUS.READY_TO_RETEST) {
        updateData.readyAt = now;
        // Sync: update the original test case status to READY TO RETEST
        const updateResult = await db.testCase.updateMany({
          where: { id: current.sourceTestCaseId },
          data: { status: TESTCASE_STATUS.READY_TO_RETEST, progress: getProgressFromStatus(TESTCASE_STATUS.READY_TO_RETEST) },
        });
        if (updateResult.count === 0) {
          return NextResponse.json(
            { error: 'Original test case tidak ditemukan. Bug fix ini tidak bisa dikirim ke Ready to Retest.' },
            { status: 404 }
          );
        }
      }
    }

    const bugFixItem = await db.bugFix.update({
      where: { id },
      data: updateData,
      include: { module: true },
    });

    return NextResponse.json(bugFixItem);
  } catch (error) {
    console.error('PUT /api/bugfix error:', error);
    return NextResponse.json({ error: 'Failed to update bug fix item' }, { status: 500 });
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
