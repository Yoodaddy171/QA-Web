import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: testPlanId } = await context.params;
  try {
    const body = await req.json();
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const requirementIds: string[] = Array.isArray(body.requirementIds) ? body.requirementIds.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0).map((value: string) => value.trim()) : [];
    const plan = await db.testPlan.findFirst({ where: { id: testPlanId, projectId }, select: { id: true } });
    if (!plan || requirementIds.length === 0) return NextResponse.json({ error: 'Test Plan atau requirement tidak valid.' }, { status: 400 });
    const requirements = await db.requirement.findMany({ where: { id: { in: requirementIds }, projectId }, select: { id: true } });
    if (requirements.length !== requirementIds.length) return NextResponse.json({ error: 'Ada requirement yang bukan milik project ini.' }, { status: 400 });
    const existing = await db.testPlanRequirement.findMany({ where: { testPlanId, requirementId: { in: requirementIds } }, select: { requirementId: true } });
    const existingIds = new Set(existing.map(item => item.requirementId));
    const newIds = [...new Set(requirementIds)].filter(requirementId => !existingIds.has(requirementId));
    if (newIds.length) await db.testPlanRequirement.createMany({ data: newIds.map(requirementId => ({ testPlanId, requirementId })) });
    return NextResponse.json({ linked: newIds.length }, { status: 201 });
  } catch (error) {
    console.error('POST test plan requirement link error:', error);
    return NextResponse.json({ error: 'Gagal menghubungkan requirement.' }, { status: 500 });
  }
}
