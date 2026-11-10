import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const cleanText = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const where: Record<string, unknown> = {};
    if (projectId) {
      const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      where.projectId = projectId;
    }

    const modules = await db.module.findMany({
      where,
      include: {
        _count: { select: { testCases: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(modules);
  } catch (error) {
    console.error('GET /api/modules error:', error);
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = cleanText(body.name);
    const projectId = cleanText(body.projectId);
    if (!name) return NextResponse.json({ error: 'Nama module wajib diisi' }, { status: 400 });
    if (!projectId) return NextResponse.json({ error: 'Project wajib dipilih' }, { status: 400 });
    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const newModule = await db.module.create({
      data: {
        name,
        projectId,
      },
    });
    return NextResponse.json(newModule, { status: 201 });
  } catch (error) {
    console.error('POST /api/modules error:', error);
    return NextResponse.json({ error: 'Failed to create module' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = cleanText(body.id);
    const name = cleanText(body.name);
    if (!id) return NextResponse.json({ error: 'ID module wajib diisi' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Nama module wajib diisi' }, { status: 400 });

    const existing = await db.module.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Module not found' }, { status: 404 });

    const updated = await db.module.update({
      where: { id },
      data: { name },
      include: { _count: { select: { testCases: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/modules error:', error);
    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const existing = await db.module.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    await db.module.delete({ where: { id } });
    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    console.error('DELETE /api/modules error:', error);
    return NextResponse.json({ error: 'Failed to delete module' }, { status: 500 });
  }
}
