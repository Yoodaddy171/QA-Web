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

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = text(body.id);
    const projectId = text(body.projectId);
    if (!id || !projectId) return NextResponse.json({ error: 'id dan projectId wajib diisi.' }, { status: 400 });
    const current = await db.testPlan.findFirst({ where: { id, projectId }, select: { id: true } });
    if (!current) return NextResponse.json({ error: 'Test Plan tidak ditemukan.' }, { status: 404 });
    const updated = await db.testPlan.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: text(body.name) }),
        ...(body.description !== undefined && { description: text(body.description) || null }),
        ...(body.status !== undefined && { status: text(body.status) || 'DRAFT' }),
      },
      include: { _count: { select: { requirements: true, testRuns: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/test-plans error:', error);
    return NextResponse.json({ error: 'Gagal mengubah Test Plan.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')?.trim() || '';
    const projectId = req.nextUrl.searchParams.get('projectId')?.trim() || '';
    if (!id || !projectId) return NextResponse.json({ error: 'id dan projectId wajib diisi.' }, { status: 400 });
    const current = await db.testPlan.findFirst({ where: { id, projectId }, select: { id: true } });
    if (!current) return NextResponse.json({ error: 'Test Plan tidak ditemukan.' }, { status: 404 });
    await db.testPlan.delete({ where: { id } });
    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    console.error('DELETE /api/test-plans error:', error);
    return NextResponse.json({ error: 'Gagal menghapus Test Plan.' }, { status: 500 });
  }
}
