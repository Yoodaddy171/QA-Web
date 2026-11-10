import { db } from '@/lib/db';
import { guestSafeResponse } from '@/lib/services/guest-response';
import { listEntityActivity, listProjectActivity, recordActivity } from '@/lib/services/activity-history-service';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  const entityType = req.nextUrl.searchParams.get('entityType')?.trim();
  const entityId = req.nextUrl.searchParams.get('entityId')?.trim();
  const action = req.nextUrl.searchParams.get('action')?.trim();
  const actor = req.nextUrl.searchParams.get('actor')?.trim();
  const search = req.nextUrl.searchParams.get('search')?.trim();
  const limit = Number(req.nextUrl.searchParams.get('limit')) || 80;

  if (!projectId) {
    return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });
  }

  try {
    if (entityType && entityId) {
      return NextResponse.json(
        await guestSafeResponse({ activities: await listEntityActivity(projectId, entityType, entityId, action) })
      );
    }

    const result = await listProjectActivity({
      projectId,
      entityType,
      action,
      actor,
      search,
      limit,
    });
    return NextResponse.json(await guestSafeResponse(result), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
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
