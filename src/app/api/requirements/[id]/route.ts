import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });
  const requirement = await db.requirement.findFirst({ where: { id, projectId }, include: { testPlans: { include: { testPlan: true } }, testCases: { include: { testCase: { select: { id: true, testCaseId: true, page: true, status: true } } } } } });
  if (!requirement) return NextResponse.json({ error: 'Requirement tidak ditemukan.' }, { status: 404 });
  return NextResponse.json(requirement);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = await req.json();
    const projectId = text(body.projectId);
    const current = await db.requirement.findFirst({ where: { id, projectId }, select: { id: true } });
    if (!current) return NextResponse.json({ error: 'Requirement tidak ditemukan.' }, { status: 404 });
    const requirement = await db.requirement.update({ where: { id }, data: { ...(body.key !== undefined && { key: text(body.key) }), ...(body.title !== undefined && { title: text(body.title) }), ...(body.description !== undefined && { description: text(body.description) || null }), ...(body.status !== undefined && { status: text(body.status) }), ...(body.priority !== undefined && { priority: text(body.priority) }) } });
    return NextResponse.json(requirement);
  } catch (error) {
    console.error('PUT /api/requirements/[id] error:', error);
    return NextResponse.json({ error: 'Gagal mengubah requirement.' }, { status: 500 });
  }
}
