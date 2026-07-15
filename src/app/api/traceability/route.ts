import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  const testCaseId = req.nextUrl.searchParams.get('testCaseId')?.trim();
  const requirementId = req.nextUrl.searchParams.get('requirementId')?.trim();
  if (!projectId || (!testCaseId && !requirementId)) return NextResponse.json({ error: 'projectId dan testCaseId atau requirementId wajib diisi.' }, { status: 400 });

  if (testCaseId) {
    const testCase = await db.testCase.findFirst({
      where: { id: testCaseId, projectId },
      select: {
        id: true, testCaseId: true, page: true, status: true,
        requirementLinks: { include: { requirement: { include: { testPlans: { include: { testPlan: true } } } } } },
        testRunCases: { include: { testRun: true, executions: { include: { evidence: true, bugFix: { select: { id: true, status: true, testCaseId: true } } }, orderBy: { createdAt: 'desc' } } } },
        bugFixItems: { include: { sourceExecution: { select: { id: true, testRunId: true, status: true, tester: true, createdAt: true } } } },
      },
    });
    if (!testCase) return NextResponse.json({ error: 'Testcase tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({
      testCase: {
        ...testCase,
        requirements: testCase.requirementLinks,
        testRuns: testCase.testRunCases,
      },
    });
  }

  const requirement = await db.requirement.findFirst({
    where: { id: requirementId, projectId },
    include: { testPlans: { include: { testPlan: { include: { testRuns: true } } } }, testCases: { include: { testCase: { select: { id: true, testCaseId: true, page: true, status: true } } } } },
  });
  if (!requirement) return NextResponse.json({ error: 'Requirement tidak ditemukan.' }, { status: 404 });
  return NextResponse.json({ requirement });
}
