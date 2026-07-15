import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const TEST_CASE_ID_PATTERN = /^(.*?)-(\d+)$/;

function makePrefixFromModuleName(name: string) {
  const words = name
    .split(/[^a-z0-9]+/i)
    .map(word => word.trim())
    .filter(Boolean);
  const initials = words.map(word => word[0]).join('').slice(0, 3);
  const prefix = initials || name.replace(/[^a-z0-9]/gi, '').slice(0, 3);
  return (prefix || 'TC').toUpperCase();
}

function getDominantPrefix(testCaseIds: string[], fallbackPrefix: string) {
  const counts = new Map<string, { count: number; maxNumber: number; width: number }>();

  for (const id of testCaseIds) {
    const match = id.trim().match(TEST_CASE_ID_PATTERN);
    if (!match) continue;

    const prefix = match[1].toUpperCase();
    const numberText = match[2];
    const number = Number.parseInt(numberText, 10);
    if (!Number.isFinite(number)) continue;

    const current = counts.get(prefix) || { count: 0, maxNumber: 0, width: 3 };
    current.count += 1;
    current.maxNumber = Math.max(current.maxNumber, number);
    current.width = Math.max(current.width, numberText.length);
    counts.set(prefix, current);
  }

  const [prefix, meta] = Array.from(counts.entries())
    .sort((a, b) => b[1].count - a[1].count || b[1].maxNumber - a[1].maxNumber)[0] || [
      fallbackPrefix,
      { count: 0, maxNumber: 0, width: 3 },
    ];

  return { prefix, ...meta };
}

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
    const moduleId = req.nextUrl.searchParams.get('moduleId')?.trim();

    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    if (!moduleId || moduleId === 'all' || moduleId === 'unassigned') {
      return NextResponse.json({ suggestedTestCaseId: '', moduleId: moduleId || null });
    }

    const moduleRecord = await db.module.findFirst({
      where: { id: moduleId, projectId },
      select: { id: true, name: true },
    });
    if (!moduleRecord) return NextResponse.json({ error: 'Module not found' }, { status: 404 });

    const [moduleCases, projectCases] = await Promise.all([
      db.testCase.findMany({
        where: { projectId, moduleId },
        select: { testCaseId: true },
      }),
      db.testCase.findMany({
        where: { projectId },
        select: { testCaseId: true },
      }),
    ]);

    const fallbackPrefix = makePrefixFromModuleName(moduleRecord.name);
    const { prefix, maxNumber, width } = getDominantPrefix(
      moduleCases.map(tc => tc.testCaseId),
      fallbackPrefix
    );
    const existingProjectIds = new Set(projectCases.map(tc => tc.testCaseId.toUpperCase()));
    let nextNumber = maxNumber + 1;
    let suggestedTestCaseId = `${prefix}-${String(nextNumber).padStart(width, '0')}`;

    while (existingProjectIds.has(suggestedTestCaseId.toUpperCase())) {
      nextNumber += 1;
      suggestedTestCaseId = `${prefix}-${String(nextNumber).padStart(width, '0')}`;
    }

    return NextResponse.json({
      suggestedTestCaseId,
      moduleId,
      moduleName: moduleRecord.name,
    });
  } catch (error) {
    console.error('GET /api/testcases/next-id error:', error);
    return NextResponse.json({ error: 'Failed to generate next test case ID' }, { status: 500 });
  }
}
