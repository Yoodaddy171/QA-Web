import { NextRequest, NextResponse } from 'next/server';
import { listNotifications } from '@/lib/services/notification-service';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });
  const limit = Number.parseInt(req.nextUrl.searchParams.get('limit') || '20', 10);
  const result = await listNotifications({
    projectId,
    recipientKey: req.nextUrl.searchParams.get('recipientKey'),
    cursor: req.nextUrl.searchParams.get('cursor'),
    unreadOnly: req.nextUrl.searchParams.get('unreadOnly') === 'true',
    limit: Number.isFinite(limit) ? limit : 20,
  });
  return NextResponse.json(result);
}
