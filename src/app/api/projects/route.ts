import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { evidenceStorage } from '@/lib/storage/evidence-storage';
import { cleanupProjectRuntimeArtifacts, deleteRecordingDirectory } from '@/lib/storage/runtime-artifact-storage';
import { getRequestActor } from '@/lib/request-actor';

const cleanText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const nullableText = (value: unknown) => {
  const text = cleanText(value);
  return text ? text : null;
};

export async function GET() {
  try {
    const actor = await getRequestActor();
    if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const projects = await db.project.findMany({
      where: { deletionState: 'ACTIVE', workspace: { memberships: { some: { userId: actor.userId } } } },
      include: {
        _count: { select: { testCases: true, modules: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(projects);
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor?.workspaceId) return NextResponse.json({ error: 'Workspace tidak ditemukan.' }, { status: 403 });
    const body = await req.json();
    const name = cleanText(body.name);
    if (!name) return NextResponse.json({ error: 'Nama project wajib diisi' }, { status: 400 });

    const project = await db.project.create({
      data: {
        name,
        description: nullableText(body.description),
        workspaceId: actor.workspaceId,
      },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    if (data.name !== undefined && !cleanText(data.name)) {
      return NextResponse.json({ error: 'Nama project wajib diisi' }, { status: 400 });
    }
    const existing = await db.project.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const project = await db.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: cleanText(data.name) }),
        ...(data.description !== undefined && { description: nullableText(data.description) }),
        ...(data.automationContext !== undefined && { automationContext: nullableText(data.automationContext) }),
      },
    });
    return NextResponse.json(project);
  } catch (error) {
    console.error('PUT /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const existing = await db.project.findUnique({ where: { id }, select: { id: true, deletionState: true } });
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (existing.deletionState === 'DELETING') return NextResponse.json({ error: 'Project sedang dihapus.' }, { status: 409 });

    await db.project.update({ where: { id }, data: { deletionState: 'DELETING', deletedAt: new Date() } });
    try {
      const [evidence, recordings, testCases, bugFixItems] = await Promise.all([
        db.testExecutionEvidence.findMany({
          where: { execution: { testRun: { projectId: id } } },
          select: { storagePath: true },
        }),
        db.recording.findMany({ where: { run: { projectId: id } }, select: { mediaRoot: true } }),
        db.testCase.findMany({ where: { projectId: id }, select: { id: true } }),
        db.bugFix.findMany({ where: { projectId: id }, select: { id: true } }),
      ]);
      for (const item of evidence) await evidenceStorage.delete(item.storagePath);
      for (const recording of recordings) await deleteRecordingDirectory(recording.mediaRoot);
      await cleanupProjectRuntimeArtifacts([...testCases, ...bugFixItems].map(item => item.id));
      await db.project.delete({ where: { id } });
      return NextResponse.json({ deleted: 1, evidenceDeleted: evidence.length, recordingsDeleted: recordings.length });
    } catch (error) {
      await db.project.update({ where: { id }, data: { deletionState: 'ACTIVE', deletedAt: null } }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error('DELETE /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
