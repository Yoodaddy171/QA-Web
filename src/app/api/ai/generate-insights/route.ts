import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { HIGH_TESTCASE_PRIORITIES, TESTCASE_STATUS, TEST_TYPES } from '@/lib/domain/testcase';

export const maxDuration = 30;

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function compact(value: unknown, max = 120) {
  const text = cleanText(value).replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function isWeakText(value: string) {
  const text = cleanText(value).toLowerCase();
  if (!text) return true;
  if (text.length < 60) return true;
  return /open page|interact with feature|perform feature action|functional test|jalankan aksi utama|siapkan data uji|amati respons|sesuai kebutuhan|berjalan dengan baik|feature works as expected/.test(text);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = cleanText(searchParams.get('projectId'));
    const moduleFilter = cleanText(searchParams.get('moduleFilter') || 'all');

    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const selectedModule = moduleFilter && moduleFilter !== 'all'
      ? await db.module.findFirst({ where: { id: moduleFilter, projectId }, select: { id: true, name: true } })
      : null;

    const where = {
      projectId,
      ...(selectedModule ? { moduleId: selectedModule.id } : {}),
    };

    const [modules, testCases, bugFixes] = await Promise.all([
      db.module.findMany({
        where: { projectId },
        select: { id: true, name: true, _count: { select: { testCases: true, bugFixItems: true } } },
        orderBy: { name: 'asc' },
      }),
      db.testCase.findMany({
        where,
        select: {
          id: true,
          testCaseId: true,
          page: true,
          subMenu: true,
          testType: true,
          priority: true,
          status: true,
          testAction: true,
          steps: true,
          expectedResult: true,
          module: { select: { id: true, name: true } },
        },
        take: 600,
      }),
      db.bugFix.findMany({
        where,
        select: {
          id: true,
          testCaseId: true,
          page: true,
          subMenu: true,
          status: true,
          priority: true,
          actualResult: true,
          module: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 80,
      }),
    ]);

    const total = testCases.length;
    const negative = testCases.filter(row => row.testType === TEST_TYPES[1]).length;
    const notDone = testCases.filter(row => row.status === TESTCASE_STATUS.NOT_DONE).length;
    const inProgress = testCases.filter(row => row.status === TESTCASE_STATUS.IN_PROGRESS).length;
    const highPriorityOpen = testCases.filter(row => HIGH_TESTCASE_PRIORITIES.includes(row.priority) && row.status !== TESTCASE_STATUS.DONE).length;
    const weakSteps = testCases.filter(row => isWeakText(row.steps));
    const genericExpected = testCases.filter(row => isWeakText(row.expectedResult));
    const activeBugFixes = bugFixes.filter(row => ![BUGFIX_STATUS.VERIFIED_FIXED, 'CLOSED', TESTCASE_STATUS.DONE].includes(row.status));

    const buckets = new Map<string, {
      label: string;
      moduleId: string | null;
      moduleName: string;
      page: string;
      subMenu: string;
      total: number;
      negative: number;
      positive: number;
      highPriority: number;
      notDone: number;
      samples: string[];
    }>();

    for (const row of testCases) {
      const key = `${row.module?.id || 'none'}|${row.page}|${row.subMenu || ''}`;
      const bucket = buckets.get(key) || {
        label: [row.page, row.subMenu].filter(Boolean).join(' > ') || row.module?.name || 'Tanpa area',
        moduleId: row.module?.id || null,
        moduleName: row.module?.name || 'Tanpa Module',
        page: row.page,
        subMenu: row.subMenu || '',
        total: 0,
        negative: 0,
        positive: 0,
        highPriority: 0,
        notDone: 0,
        samples: [],
      };
      bucket.total += 1;
      if (row.testType === TEST_TYPES[1]) bucket.negative += 1;
      else bucket.positive += 1;
      if (HIGH_TESTCASE_PRIORITIES.includes(row.priority)) bucket.highPriority += 1;
      if (row.status === TESTCASE_STATUS.NOT_DONE) bucket.notDone += 1;
      if (bucket.samples.length < 3) bucket.samples.push(row.testCaseId);
      buckets.set(key, bucket);
    }

    const gapAreas = Array.from(buckets.values())
      .map(area => ({
        ...area,
        negativeRatio: area.total ? Number((area.negative / area.total).toFixed(2)) : 0,
        score: (area.negative === 0 ? 12 : 0) + area.total + area.highPriority * 2 + area.notDone,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const riskModules = modules
      .map(module => {
        const rows = testCases.filter(row => row.module?.id === module.id);
        const openHigh = rows.filter(row => HIGH_TESTCASE_PRIORITIES.includes(row.priority) && row.status !== TESTCASE_STATUS.DONE).length;
        const moduleNegative = rows.filter(row => row.testType === TEST_TYPES[1]).length;
        const moduleNotDone = rows.filter(row => row.status === TESTCASE_STATUS.NOT_DONE).length;
        return {
          id: module.id,
          name: module.name,
          total: rows.length,
          negative: moduleNegative,
          openHigh,
          notDone: moduleNotDone,
          score: openHigh * 5 + moduleNotDone * 2 + (rows.length > 0 && moduleNegative === 0 ? 8 : 0),
        };
      })
      .filter(module => module.total > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const suggestions = [
      ...gapAreas.slice(0, 3).map(area => `Buat missing negative cases untuk ${area.moduleName} - ${area.label}`),
      highPriorityOpen > 0 ? 'Buat testcase retest untuk prioritas High/Critical yang belum DONE' : '',
      activeBugFixes.length > 0 ? 'Buat testcase retest berdasarkan bugfix yang masih aktif' : '',
      weakSteps.length > 0 ? 'Buat refinement testcase untuk steps yang masih generic' : '',
      genericExpected.length > 0 ? 'Buat negative case dengan expected result yang lebih spesifik' : '',
    ].filter(Boolean).slice(0, 5);

    const recommendation = (() => {
      if (activeBugFixes.length > 0) return `Prioritas utama: buat retest case untuk ${activeBugFixes.length} bugfix yang belum verified.`;
      if (gapAreas[0] && gapAreas[0].negative === 0) return `Prioritas utama: tambah negative case di ${gapAreas[0].moduleName} - ${gapAreas[0].label}, karena belum ada negative coverage.`;
      if (highPriorityOpen > 0) return `Prioritas utama: lengkapi coverage untuk ${highPriorityOpen} testcase High/Critical yang belum DONE.`;
      if (weakSteps.length > 0) return `Prioritas utama: perbaiki steps ${weakSteps.length} testcase yang masih sulit dieksekusi manual.`;
      return 'Coverage terlihat cukup stabil. Rekomendasi: tambah edge case spesifik untuk area dengan coverage paling besar.';
    })();

    return NextResponse.json({
      project: { id: project.id, name: project.name },
      scope: selectedModule ? { moduleId: selectedModule.id, moduleName: selectedModule.name } : { moduleId: null, moduleName: 'Semua Module' },
      summary: {
        total,
        positive: total - negative,
        negative,
        negativeRatio: total ? Number((negative / total).toFixed(2)) : 0,
        notDone,
        inProgress,
        highPriorityOpen,
        activeBugFixes: activeBugFixes.length,
        weakSteps: weakSteps.length,
        genericExpected: genericExpected.length,
      },
      recommendation,
      suggestions,
      gapAreas: gapAreas.map(area => ({
        label: area.label,
        moduleName: area.moduleName,
        total: area.total,
        negative: area.negative,
        positive: area.positive,
        negativeRatio: area.negativeRatio,
        samples: area.samples,
      })),
      riskModules,
      examples: {
        weakSteps: weakSteps.slice(0, 4).map(row => ({ id: row.testCaseId, action: compact(row.testAction, 80) })),
        genericExpected: genericExpected.slice(0, 4).map(row => ({ id: row.testCaseId, expected: compact(row.expectedResult, 80) })),
        activeBugFixes: activeBugFixes.slice(0, 4).map(row => ({ id: row.testCaseId, status: row.status, actual: compact(row.actualResult, 80) })),
      },
    });
  } catch (error) {
    console.error('GET /api/ai/generate-insights error:', error);
    return NextResponse.json({ error: 'Gagal membaca rekomendasi AI.' }, { status: 500 });
  }
}
