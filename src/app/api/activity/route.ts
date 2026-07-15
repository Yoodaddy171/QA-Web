import { db } from '@/lib/db';
import { listEntityActivity, recordActivity } from '@/lib/services/activity-history-service';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  const entityType = req.nextUrl.searchParams.get('entityType')?.trim();
  const entityId = req.nextUrl.searchParams.get('entityId')?.trim();
  const action = req.nextUrl.searchParams.get('action')?.trim();
  if (!projectId || !entityType || !entityId) return NextResponse.json({ error: 'projectId, entityType, dan entityId wajib diisi.' }, { status: 400 });

  try {
    return NextResponse.json({ activities: await listEntityActivity(projectId, entityType, entityId, action) });
  } catch (error) {
    console.error('GET /api/activity error:', error);
    return NextResponse.json({ error: 'Gagal memuat activity history.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const entityType = typeof body.entityType === 'string' ? body.entityType.trim() : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : '';
    const action = typeof body.action === 'string' ? body.action.trim() : '';
    if (!projectId || !entityId || entityType !== 'TestCase' || action !== 'COMMENTED') return NextResponse.json({ error: 'Komentar hanya dapat dibuat untuk TestCase yang valid.' }, { status: 400 });
    const testCase = await db.testCase.findFirst({ where: { id: entityId, projectId }, select: { id: true } });
    if (!testCase) return NextResponse.json({ error: 'Testcase tidak ditemukan.' }, { status: 404 });
    const comment = body.afterValue && typeof body.afterValue.comment === 'string' ? body.afterValue.comment.trim() : '';
    if (!comment) return NextResponse.json({ error: 'Komentar wajib diisi.' }, { status: 400 });
    const activity = await recordActivity({ projectId, entityType, entityId, action, afterValue: { comment } });
    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error('POST /api/activity error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan komentar.' }, { status: 500 });
  }
}
