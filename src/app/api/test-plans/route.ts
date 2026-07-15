import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });
  const testPlans = await db.testPlan.findMany({ where: { projectId }, include: { _count: { select: { requirements: true, testRuns: true } } }, orderBy: { updatedAt: 'desc' } });
  return NextResponse.json({ testPlans });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId = text(body.projectId);
    const name = text(body.name);
    if (!projectId || !name) return NextResponse.json({ error: 'projectId dan name wajib diisi.' }, { status: 400 });
    const testPlan = await db.testPlan.create({ data: { projectId, name, description: text(body.description) || null, status: text(body.status) || 'DRAFT' } });
    return NextResponse.json(testPlan, { status: 201 });
  } catch (error) {
    console.error('POST /api/test-plans error:', error);
    return NextResponse.json({ error: 'Gagal membuat Test Plan.' }, { status: 500 });
  }
}
