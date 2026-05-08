import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const TESTCASE_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'testCaseId', 'page', 'status', 'priority', 'testType']);
const TESTCASE_STATUSES = new Set(['DONE', 'NOT DONE', 'IN PROGRESS', 'BLOCKED', 'FAILED', 'READY TO RETEST', 'TBA']);
const TEST_TYPES = new Set(['Positive', 'Negative']);
const PRIORITIES = new Set(['Low', 'Medium', 'High', 'Critical']);

// Auto-calculate progress based on status
const getProgressFromStatus = (status: string): number => {
  switch (status) {
    case 'DONE': return 100;
    case 'IN PROGRESS': return 50;
    case 'BLOCKED': return 0;
    case 'NOT DONE': return 0;
    case 'FAILED': return 0;
    case 'READY TO RETEST': return 50;
    case 'TBA': return 0; // Excluded from progress calculations
    default: return 0;
  }
};

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
    const status = url.searchParams.get('status');
    const testType = url.searchParams.get('testType');
    const priority = url.searchParams.get('priority');
    const search = url.searchParams.get('search');
    const page = parsePositiveInt(url.searchParams.get('page'), 1, 100000);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 50, 200);
    const requestedSortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortBy = TESTCASE_SORT_FIELDS.has(requestedSortBy) ? requestedSortBy : 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};
    if (projectId) {
      const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      where.projectId = projectId;
    }
    if (moduleId) {
      const moduleRecord = await db.module.findFirst({
        where: { id: moduleId, ...(projectId ? { projectId } : {}) },
        select: { id: true },
      });
      if (!moduleRecord) return NextResponse.json({ error: 'Module not found' }, { status: 404 });
      where.moduleId = moduleId;
    }
    if (status) {
      if (!TESTCASE_STATUSES.has(status)) return validationError('Status testcase tidak valid.');
      where.status = status;
    }
    if (testType) {
      if (!TEST_TYPES.has(testType)) return validationError('Tipe testcase tidak valid.');
      where.testType = testType;
    }
    if (priority) {
      if (!PRIORITIES.has(priority)) return validationError('Prioritas testcase tidak valid.');
      where.priority = priority;
    }
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { testCaseId: { contains: search } },
        { page: { contains: search } },
        { subMenu: { contains: search } },
        { testAction: { contains: search } },
        { steps: { contains: search } },
        { remarks: { contains: search } },
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
        priority: true,
        projectId: true,
        moduleId: true,
        createdAt: true,
        updatedAt: true,
        project: true,
        module: true,
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
    const status = TESTCASE_STATUSES.has(body.status) ? body.status : 'NOT DONE';
    const testType = TEST_TYPES.has(body.testType) ? body.testType : 'Positive';
    const priority = PRIORITIES.has(body.priority) ? body.priority : 'Medium';

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

    const testCase = await db.testCase.create({
      data: {
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
        priority,
        projectId,
        moduleId,
      },
      include: { project: true, module: true },
    });

    // Recalculate weights for all test cases in the same menu (background, non-blocking)
    recalculateWeights(projectId, page, subMenu).catch(() => {});

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
      select: { projectId: true, page: true, subMenu: true, status: true, actualResult: true, testCaseId: true, testType: true, testAction: true, steps: true, expectedResult: true, priority: true, moduleId: true },
    });
    if (!current) return NextResponse.json({ error: 'Test case not found' }, { status: 404 });

    // Keep status and actual result in sync for the bug-fix retest flow.
    let finalStatus = data.status ?? current.status;
    if (!TESTCASE_STATUSES.has(finalStatus)) return validationError('Status testcase tidak valid.');
    if (data.testType !== undefined && !TEST_TYPES.has(data.testType)) return validationError('Tipe testcase tidak valid.');
    if (data.priority !== undefined && !PRIORITIES.has(data.priority)) return validationError('Prioritas testcase tidak valid.');
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
    let finalActualResult = data.actualResult !== undefined ? data.actualResult : current.actualResult;

    if (finalStatus === 'DONE') {
      finalActualResult = 'As Expected';
    }

    if (finalActualResult === 'Not As Expected') {
      finalStatus = 'FAILED';
    } else if (finalActualResult === 'As Expected' && (current.status === 'FAILED' || finalStatus === 'DONE')) {
      finalStatus = 'DONE';
    }

    // Handle moduleId: convert empty string to null for Prisma
    const finalModuleId = data.moduleId === '' || data.moduleId === null ? null : data.moduleId;
    if (finalModuleId) {
      const moduleRecord = await db.module.findFirst({ where: { id: finalModuleId, projectId: current.projectId }, select: { id: true } });
      if (!moduleRecord) return NextResponse.json({ error: 'Module tidak ditemukan pada project ini.' }, { status: 404 });
    }
    // Handle subMenu: convert empty string to null
    const finalSubMenu = data.subMenu === '' ? null : data.subMenu;
    // Handle actualResult: convert empty string to null
    const finalActualResultForDb = finalActualResult === '' ? null : finalActualResult;
    const shouldWriteActualResult = data.actualResult !== undefined
      || (finalStatus === 'DONE' && finalActualResultForDb === 'As Expected' && current.actualResult !== 'As Expected');

    // Auto-calculate progress from status
    const progress = getProgressFromStatus(finalStatus || current.status);

    const testCase = await db.testCase.update({
      where: { id },
      data: {
        ...(data.testCaseId !== undefined && { testCaseId: cleanText(data.testCaseId) }),
        ...(data.page !== undefined && { page: cleanText(data.page) }),
        ...(data.subMenu !== undefined && { subMenu: finalSubMenu }),
        ...(data.weight !== undefined && { weight: data.weight }),
        ...(data.testType !== undefined && { testType: data.testType }),
        ...(data.testAction !== undefined && { testAction: cleanText(data.testAction) }),
        ...(data.steps !== undefined && { steps: cleanText(data.steps) }),
        ...(data.expectedResult !== undefined && { expectedResult: cleanText(data.expectedResult) }),
        ...(shouldWriteActualResult && { actualResult: finalActualResultForDb }),
        ...(data.stepLogs !== undefined && { stepLogs: data.stepLogs }),
        ...(finalStatus !== undefined && { status: finalStatus }),
        ...(progress !== undefined && { progress }),
        ...(data.remarks !== undefined && { remarks: data.remarks }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.moduleId !== undefined && { moduleId: finalModuleId }),
      },
      include: { project: true, module: true },
    });

    // If status became FAILED, auto-copy to BugFix table (if not already there)
    if (finalStatus === 'FAILED') {
      const existingBugFix = await db.bugFix.findFirst({
        where: { sourceTestCaseId: id },
      });
      if (!existingBugFix) {
        await db.bugFix.create({
          data: {
            sourceTestCaseId: id,
            testCaseId: current.testCaseId,
            projectId: current.projectId,
            page: current.page,
            subMenu: current.subMenu,
            testType: current.testType,
            testAction: current.testAction,
            steps: current.steps,
            expectedResult: current.expectedResult,
            actualResult: 'Not As Expected',
            priority: current.priority,
            moduleId: current.moduleId,
            status: 'SUDAH DILAPORKAN',
            reportedAt: new Date(),
          },
        });
      }
    } else if (finalStatus === 'DONE' || finalActualResultForDb === 'As Expected') {
      // A bug is only verified after its source test case passes retest.
      await db.bugFix.updateMany({
        where: { 
          sourceTestCaseId: id,
          status: { not: 'VERIFIED & FIXED' }
        },
        data: {
          status: 'VERIFIED & FIXED',
          fixedAt: new Date()
        }
      });
    }

    // Recalculate weights if page/subMenu changed (background, non-blocking)
    const pageChanged = data.page !== undefined && data.page !== current.page;
    const subMenuChanged = finalSubMenu !== current.subMenu;
    if (pageChanged || subMenuChanged) {
      recalculateWeights(current.projectId, current.page, current.subMenu).catch(() => {});
      recalculateWeights(testCase.projectId, testCase.page, testCase.subMenu).catch(() => {});
    }

    return NextResponse.json(testCase);
  } catch (error) {
    console.error('PUT /api/testcases error:', error);
    return NextResponse.json({ error: 'Failed to update test case' }, { status: 500 });
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
      const casesToDelete = await db.testCase.findMany({
        where: { id: { in: idList } },
        select: { id: true, projectId: true, page: true, subMenu: true },
      });
      await db.testCase.deleteMany({ where: { id: { in: idList } } });

      // Recalculate weights for affected menus (background)
      const affectedMenus = new Set<string>();
      for (const tc of casesToDelete) {
        affectedMenus.add(`${tc.projectId}|||${tc.page}|||${tc.subMenu || ''}`);
      }
      for (const key of affectedMenus) {
        const [projId, page, subMenu] = key.split('|||');
        recalculateWeights(projId, page, subMenu === '' ? null : subMenu).catch(() => {});
      }

      return NextResponse.json({ deleted: idList.length });
    }

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const tc = await db.testCase.findUnique({ where: { id }, select: { projectId: true, page: true, subMenu: true } });
    if (!tc) return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    await db.testCase.delete({ where: { id } });

    recalculateWeights(tc.projectId, tc.page, tc.subMenu).catch(() => {});

    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    console.error('DELETE /api/testcases error:', error);
    return NextResponse.json({ error: 'Failed to delete test case' }, { status: 500 });
  }
}

// Helper: Recalculate weight for all test cases in a menu
async function recalculateWeights(projectId: string, page: string, subMenu: string | null) {
  // Only count active (non-TBA) test cases for weight calculation
  const casesInMenu = await db.testCase.findMany({
    where: { projectId, page, subMenu: subMenu || null, status: { not: 'TBA' } },
    select: { id: true },
  });

  if (casesInMenu.length === 0) return;

  const weightPerCase = (100 / casesInMenu.length).toFixed(2) + '%';

  const caseIds = casesInMenu.map(tc => tc.id);

  // Batch update all cases in menu with calculated weight
  await db.testCase.updateMany({
    where: { id: { in: caseIds } },
    data: { weight: weightPerCase },
  });

  // Set weight to null for TBA test cases in this menu (they don't contribute)
  await db.testCase.updateMany({
    where: { projectId, page, subMenu: subMenu || null, status: 'TBA' },
    data: { weight: null },
  });
}
