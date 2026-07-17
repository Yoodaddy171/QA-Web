import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const KNOWLEDGE_TYPES = new Set([
  'API_DOCS',
  'FEATURE_MAP',
  'QA_RULES',
  'DOMAIN_DICTIONARY',
  'TEST_STRATEGY',
  'CHANGELOG',
  'KNOWN_ISSUE',
  'ENV_NOTE',
  'AI_PROFILE',
  'QA_PREFERENCE',
  'PROJECT_RULE',
]);

const cleanText = (value: unknown) => String(value ?? '').trim();

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function normalizeType(value: unknown) {
  const type = cleanText(value).toUpperCase();
  return KNOWLEDGE_TYPES.has(type) ? type : 'QA_RULES';
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = cleanText(url.searchParams.get('projectId'));
    if (!projectId) return validationError('projectId is required');

    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const items = await db.projectKnowledge.findMany({ where: { projectId }, orderBy: { updatedAt: 'desc' } });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('GET /api/project-knowledge error:', error);
    return NextResponse.json({ error: 'Failed to fetch project knowledge' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId = cleanText(body.projectId);
    const title = cleanText(body.title);
    const content = cleanText(body.content);
    const type = normalizeType(body.type);

    if (!projectId) return validationError('projectId is required');
    if (!title) return validationError('Judul knowledge wajib diisi.');
    if (!content) return validationError('Isi knowledge wajib diisi.');

    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const item = await db.projectKnowledge.create({ data: { projectId, type, title, content } });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('POST /api/project-knowledge error:', error);
    return NextResponse.json({ error: 'Failed to create project knowledge' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = cleanText(body.id);
    const title = cleanText(body.title);
    const content = cleanText(body.content);
    const type = normalizeType(body.type);

    if (!id) return validationError('ID is required');
    if (!title) return validationError('Judul knowledge wajib diisi.');
    if (!content) return validationError('Isi knowledge wajib diisi.');

    const existing = await db.projectKnowledge.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Knowledge not found' }, { status: 404 });
    const item = await db.projectKnowledge.update({ where: { id }, data: { type, title, content } });
    return NextResponse.json(item);
  } catch (error) {
    console.error('PUT /api/project-knowledge error:', error);
    return NextResponse.json({ error: 'Failed to update project knowledge' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = cleanText(url.searchParams.get('id'));
    if (!id) return validationError('ID is required');

    const result = await db.projectKnowledge.deleteMany({ where: { id } });
    if (!result.count) return NextResponse.json({ error: 'Knowledge not found' }, { status: 404 });
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error('DELETE /api/project-knowledge error:', error);
    return NextResponse.json({ error: 'Failed to delete project knowledge' }, { status: 500 });
  }
}
