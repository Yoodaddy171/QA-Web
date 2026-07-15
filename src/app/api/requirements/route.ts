import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });
  const requirements = await db.requirement.findMany({ where: { projectId }, include: { _count: { select: { testCases: true, testPlans: true } } }, orderBy: { updatedAt: 'desc' } });
  return NextResponse.json({ requirements });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId = text(body.projectId);
    const key = text(body.key);
    const title = text(body.title);
    if (!projectId || !key || !title) return NextResponse.json({ error: 'projectId, key, dan title wajib diisi.' }, { status: 400 });
    const requirement = await db.requirement.create({ data: { projectId, key, title, description: text(body.description) || null, status: text(body.status) || 'DRAFT', priority: text(body.priority) || 'Medium' } });
    return NextResponse.json(requirement, { status: 201 });
  } catch (error) {
    console.error('POST /api/requirements error:', error);
    return NextResponse.json({ error: 'Gagal membuat requirement.' }, { status: 500 });
  }
}
