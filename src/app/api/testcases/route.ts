import { db } from '@/lib/db';
import { getProgressFromStatus } from '@/lib/domain/progress';
import {
  isTestCasePriority,
  isTestCaseStatus,
  isTestType,
  resolveTestCaseStatusTransition,
  TESTCASE_ACTUAL_RESULT,
  TESTCASE_STATUS,
} from '@/lib/domain/testcase';
import {
  bulkUpdateTestCaseStatus,
  createTestCaseRecord,
  deleteTestCaseById,
  deleteTestCasesByIds,
  resequenceTestCaseIdsForProject,
  updateTestCaseRecordWithBugFixSync,
} from '@/lib/services/testcase-service';
import { scheduleWeightRecalculation } from '@/lib/services/weight-service';
import { NextRequest, NextResponse } from 'next/server';

const TESTCASE_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'testCaseId', 'page', 'status', 'priority', 'testType']);

const cleanText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const cleanNullableText = (value: unknown) => {
  const text = cleanText(value);
  return text ? text : null;
};

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const moduleId = url.searchParams.get('moduleId');
    const subMenu = url.searchParams.get('subMenu');
    const status = url.searchParams.get('status');
    const testType = url.searchParams.get('testType');
    const priority = url.searchParams.get('priority');
    const tag = cleanText(url.searchParams.get('tag'));
    const createdFrom = url.searchParams.get('createdFrom');
    const createdTo = url.searchParams.get('createdTo');
    const testRunId = url.searchParams.get('testRunId');
    const hasBug = url.searchParams.get('hasBug');
    const search = url.searchParams.get('search');
    const page = parsePositiveInt(url.searchParams.get('page'), 1, 100000);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 50, 200);
    const requestedSortBy = url.searchParams.get('sortBy') || 'testCaseId';
    const sortBy = TESTCASE_SORT_FIELDS.has(requestedSortBy) ? requestedSortBy : 'testCaseId';
    const sortOrder = url.searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

    const where: Record<string, unknown> = {};
    if (projectId) {
      const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      where.projectId = projectId;
      // Repair legacy gaps as part of loading the list, so refresh also fixes
      // IDs that were deleted before resequencing was introduced.
      await resequenceTestCaseIdsForProject(projectId);
    }
    if (moduleId === 'unassigned') {
      where.moduleId = null;
    } else if (moduleId) {
      const moduleRecord = await db.module.findFirst({
        where: { id: moduleId, ...(projectId ? { projectId } : {}) },
        select: { id: true },
      });
      if (!moduleRecord) return NextResponse.json({ error: 'Module not found' }, { status: 404 });
      where.moduleId = moduleId;
    }
    if (subMenu) {
      where.subMenu = subMenu === '__empty__' ? null : subMenu;
    }
    if (status) {
      if (!isTestCaseStatus(status)) return validationError('Status testcase tidak valid.');
      where.status = status;
    }
    if (testType) {
      if (!isTestType(testType)) return validationError('Tipe testcase tidak valid.');
      where.testType = testType;
    }
    if (priority) {
      if (!isTestCasePriority(priority)) return validationError('Prioritas testcase tidak valid.');
      where.priority = priority;
    }
    if (tag) where.tags = { contains: tag };
    if (createdFrom || createdTo) {
      const createdAt: Record<string, Date> = {};
      if (createdFrom) {
        const date = new Date(createdFrom);
        if (Number.isNaN(date.getTime())) return validationError('createdFrom tidak valid.');
        createdAt.gte = date;
      }
      if (createdTo) {
        const date = new Date(createdTo);
        if (Number.isNaN(date.getTime())) return validationError('createdTo tidak valid.');
        date.setHours(23, 59, 59, 999);
        createdAt.lte = date;
      }
      where.createdAt = createdAt;
    }
    if (testRunId) {
      const run = await db.testRun.findFirst({ where: { id: testRunId, ...(projectId ? { projectId } : {}) }, select: { id: true } });
      if (!run) return NextResponse.json({ error: 'Test Run not found' }, { status: 404 });
      where.testRunCases = { some: { testRunId } };
    }
    if (hasBug === 'yes') where.bugFixItems = { some: {} };
    if (hasBug === 'no') where.bugFixItems = { none: {} };
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { testCaseId: { contains: search } },
        { page: { contains: search } },
        { subMenu: { contains: search } },
        { testAction: { contains: search } },
        { steps: { contains: search } },
        { remarks: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    const total = await db.testCase.count({ where });
    const testCases = await db.testCase.findMany({
      where,
      select: {
        id: true,
        testCaseId: true,
        page: true,
        subMenu: true,
        weight: true,
        testType: true,
        testAction: true,
        steps: true,
        expectedResult: true,
        actualResult: true,
        status: true,
        progress: true,
        remarks: true,
        tags: true,
        priority: true,
        projectId: true,
        moduleId: true,
        createdAt: true,
        updatedAt: true,
        module: { select: { id: true, name: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Use stored weight field to calculate numeric weight (no extra DB query needed)
    const enrichedCases = testCases.map(tc => {
      const weightStr = tc.weight || '';
      const calculatedWeight = weightStr ? parseFloat(weightStr.replace('%', '')) : null;
      return {
        ...tc,
        calculatedWeight: calculatedWeight !== null && !isNaN(calculatedWeight) ? Math.round(calculatedWeight * 100) / 100 : null,
      };
    });

    return NextResponse.json({ testCases: enrichedCases, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('GET /api/testcases error:', error);
    return NextResponse.json({ error: 'Failed to fetch test cases' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const testCaseId = cleanText(body.testCaseId);
    const page = cleanText(body.page);
    const testAction = cleanText(body.testAction);
    const steps = cleanText(body.steps);
    const expectedResult = cleanText(body.expectedResult);
    const projectId = cleanText(body.projectId);
    const status = isTestCaseStatus(body.status) ? body.status : TESTCASE_STATUS.NOT_DONE;
    const testType = isTestType(body.testType) ? body.testType : 'Positive';
    const priority = isTestCasePriority(body.priority) ? body.priority : 'Medium';
    const tags = normalizeTags(body.tags);

    if (!projectId) return validationError('Project wajib dipilih.');
    if (!testCaseId) return validationError('Test Case ID wajib diisi.');
    if (!page) return validationError('Page wajib diisi.');
    if (!testAction) return validationError('Test Action wajib diisi.');
    if (!steps) return validationError('Steps wajib diisi.');
    if (!expectedResult) return validationError('Expected Result wajib diisi.');
    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const duplicate = await db.testCase.findFirst({
      where: { projectId, testCaseId },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: `Test Case ID "${testCaseId}" sudah digunakan di project ini.` }, { status: 409 });

    const progress = getProgressFromStatus(status);

    // Normalize empty strings to null for optional fields
    const subMenu = cleanNullableText(body.subMenu);
    const weight = cleanNullableText(body.weight);
    const actualResult = cleanNullableText(body.actualResult);
    const remarks = cleanNullableText(body.remarks);
    const moduleId = cleanNullableText(body.moduleId);
    if (moduleId) {
      const moduleRecord = await db.module.findFirst({ where: { id: moduleId, projectId }, select: { id: true } });
      if (!moduleRecord) return NextResponse.json({ error: 'Module tidak ditemukan pada project ini.' }, { status: 404 });
    }

    const testCase = await createTestCaseRecord({
      testCaseId,
      page,
      subMenu,
      weight,
      testType,
      testAction,
      steps,
      expectedResult,
      actualResult,
      status,
      progress,
      remarks,
      tags,
      priority,
      projectId,
      moduleId,
      actor: 'local-user',
    });

    scheduleWeightRecalculation([{ projectId, page, subMenu }], 'test case create');

    return NextResponse.json(testCase, { status: 201 });
  } catch (error) {
    console.error('POST /api/testcases error:', error);
    return NextResponse.json({ error: 'Failed to create test case' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Get current test case for comparison
    const current = await db.testCase.findUnique({
      where: { id },
      select: { projectId: true, page: true, subMenu: true, status: true, actualResult: true, testCaseId: true, testType: true, testAction: true, steps: true, expectedResult: true, priority: true, moduleId: true, remarks: true, tags: true, weight: true },
    });
    if (!current) return NextResponse.json({ error: 'Test case not found' }, { status: 404 });

    // Keep status and actual result in sync for the bug-fix retest flow.
    if (!isTestCaseStatus(data.status ?? current.status)) return validationError('Status testcase tidak valid.');
    if (data.testType !== undefined && !isTestType(data.testType)) return validationError('Tipe testcase tidak valid.');
    if (data.priority !== undefined && !isTestCasePriority(data.priority)) return validationError('Prioritas testcase tidak valid.');
    if (data.testCaseId !== undefined && !cleanText(data.testCaseId)) return validationError('Test Case ID wajib diisi.');
    if (data.page !== undefined && !cleanText(data.page)) return validationError('Page wajib diisi.');
    if (data.testAction !== undefined && !cleanText(data.testAction)) return validationError('Test Action wajib diisi.');
    if (data.steps !== undefined && !cleanText(data.steps)) return validationError('Steps wajib diisi.');
    if (data.expectedResult !== undefined && !cleanText(data.expectedResult)) return validationError('Expected Result wajib diisi.');
    if (data.testCaseId !== undefined) {
      const duplicate = await db.testCase.findFirst({
        where: {
          projectId: current.projectId,
          testCaseId: cleanText(data.testCaseId),
          id: { not: id },
        },
        select: { id: true },
      });
      if (duplicate) return NextResponse.json({ error: `Test Case ID "${cleanText(data.testCaseId)}" sudah digunakan di project ini.` }, { status: 409 });
    }
    const { finalStatus, finalActualResult } = resolveTestCaseStatusTransition({
      currentStatus: current.status,
      currentActualResult: current.actualResult,
      nextStatus: data.status,
      nextActualResult: data.actualResult,
    });

    // Handle moduleId: convert empty string to null for Prisma
    const finalModuleId = data.moduleId === '' || data.moduleId === null ? null : data.moduleId;
    if (finalModuleId) {
      const moduleRecord = await db.module.findFirst({ where: { id: finalModuleId, projectId: current.projectId }, select: { id: true } });
      if (!moduleRecord) return NextResponse.json({ error: 'Module tidak ditemukan pada project ini.' }, { status: 404 });
    }
    // Handle subMenu: convert empty string to null
    const finalSubMenu = data.subMenu === '' ? null : data.subMenu;
    if (data.tags !== undefined && typeof data.tags !== 'string' && !Array.isArray(data.tags)) return validationError('Tags tidak valid.');
    if (data.tags !== undefined) data.tags = normalizeTags(data.tags);
    // Handle actualResult: convert empty string to null
    const finalActualResultForDb = finalActualResult === '' ? null : finalActualResult;
    const shouldWriteActualResult = data.actualResult !== undefined
      || (finalStatus === TESTCASE_STATUS.DONE && finalActualResultForDb === TESTCASE_ACTUAL_RESULT.AS_EXPECTED && current.actualResult !== TESTCASE_ACTUAL_RESULT.AS_EXPECTED);

    // Auto-calculate progress from status
    const progress = getProgressFromStatus(finalStatus || current.status);

    const testCase = await updateTestCaseRecordWithBugFixSync({
      id,
      data,
      current,
      finalStatus,
      finalActualResultForDb,
      shouldWriteActualResult,
      progress,
      finalModuleId,
      finalSubMenu,
      actor: 'local-user',
    });

    // Recalculate weights if page/subMenu changed (background, non-blocking)
    const pageChanged = data.page !== undefined && data.page !== current.page;
    const subMenuChanged = finalSubMenu !== current.subMenu;
    if (pageChanged || subMenuChanged) {
      scheduleWeightRecalculation([
        { projectId: current.projectId, page: current.page, subMenu: current.subMenu },
        { projectId: testCase.projectId, page: testCase.page, subMenu: testCase.subMenu },
      ], 'test case update');
    }

    return NextResponse.json(testCase);
  } catch (error) {
    console.error('PUT /api/testcases error:', error);
    return NextResponse.json({ error: 'Failed to update test case' }, { status: 500 });
  }
}

function normalizeTags(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(values.map(item => String(item).trim().toLowerCase()).filter(Boolean))].join(', ') || null;
}

// Bulk status update: { ids: string[], status: string }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === 'string' && id) : [];
    if (ids.length === 0) return validationError('IDs wajib diisi.');
    if (ids.length > 500) return validationError('Maksimal 500 test case per operasi bulk.');
    if (!isTestCaseStatus(body.status)) return validationError('Status testcase tidak valid.');

    const result = await bulkUpdateTestCaseStatus(ids, body.status);
    return NextResponse.json(result);
  } catch (error) {
    console.error('PATCH /api/testcases error:', error);
    return NextResponse.json({ error: 'Failed to bulk update test cases' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const ids = url.searchParams.get('ids');

    if (ids) {
      const idList = ids.split(',').map(id => id.trim()).filter(Boolean);
      if (idList.length === 0) return validationError('ID is required');
      const result = await deleteTestCasesByIds(idList);
      scheduleWeightRecalculation(result.weightTargets, 'test case bulk delete');

      return NextResponse.json({ deleted: result.deleted });
    }

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const result = await deleteTestCaseById(id);
    if (!result) return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    scheduleWeightRecalculation(result.weightTargets, 'test case delete');

    return NextResponse.json({ deleted: result.deleted });
  } catch (error) {
    console.error('DELETE /api/testcases error:', error);
    return NextResponse.json({ error: 'Failed to delete test case' }, { status: 500 });
  }
}
