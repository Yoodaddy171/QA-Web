import { NextRequest, NextResponse } from 'next/server';
import { markAllNotificationsRead } from '@/lib/services/notification-service';

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  if (!projectId) return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });
  const result = await markAllNotificationsRead({
    projectId,
    recipientKey: typeof body.recipientKey === 'string' ? body.recipientKey : null,
  });
  return NextResponse.json({ updated: result.count });
}
