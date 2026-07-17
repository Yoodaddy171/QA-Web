import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: requirementId } = await context.params;
  try {
    const body = await req.json();
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const testCaseIds: string[] = Array.isArray(body.testCaseIds) ? body.testCaseIds.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0).map((value: string) => value.trim()) : [];
    const requirement = await db.requirement.findFirst({ where: { id: requirementId, projectId }, select: { id: true } });
    if (!requirement || testCaseIds.length === 0) return NextResponse.json({ error: 'Requirement atau testcase tidak valid.' }, { status: 400 });
    const testCases = await db.testCase.findMany({ where: { id: { in: testCaseIds }, projectId }, select: { id: true } });
    if (testCases.length !== testCaseIds.length) return NextResponse.json({ error: 'Ada testcase yang bukan milik project ini.' }, { status: 400 });
    const existing = await db.requirementTestCase.findMany({ where: { requirementId, testCaseId: { in: testCaseIds } }, select: { testCaseId: true } });
    const existingIds = new Set(existing.map(item => item.testCaseId));
    const newIds = [...new Set(testCaseIds)].filter(testCaseId => !existingIds.has(testCaseId));
    if (newIds.length) await db.requirementTestCase.createMany({ data: newIds.map(testCaseId => ({ requirementId, testCaseId })) });
    return NextResponse.json({ linked: newIds.length }, { status: 201 });
  } catch (error) {
    console.error('POST requirement testcase link error:', error);
    return NextResponse.json({ error: 'Gagal menghubungkan testcase.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: requirementId } = await context.params;
  try {
    const body = await req.json();
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const testCaseIds: string[] = Array.isArray(body.testCaseIds) ? body.testCaseIds.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0).map((value: string) => value.trim()) : [];
    const requirement = await db.requirement.findFirst({ where: { id: requirementId, projectId }, select: { id: true } });
    if (!requirement || testCaseIds.length === 0) return NextResponse.json({ error: 'Requirement atau testcase tidak valid.' }, { status: 400 });
    const result = await db.requirementTestCase.deleteMany({ where: { requirementId, testCaseId: { in: testCaseIds }, testCase: { projectId } } });
    return NextResponse.json({ unlinked: result.count });
  } catch (error) {
    console.error('DELETE requirement testcase link error:', error);
    return NextResponse.json({ error: 'Gagal melepas relasi testcase.' }, { status: 500 });
  }
}
