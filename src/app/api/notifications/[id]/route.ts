import { NextRequest, NextResponse } from 'next/server';
import { setNotificationReadState } from '@/lib/services/notification-service';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  if (!projectId) return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });
  const notification = await setNotificationReadState({
    id,
    projectId,
    recipientKey: typeof body.recipientKey === 'string' ? body.recipientKey : null,
    read: body.read !== false,
  });
  if (!notification) return NextResponse.json({ error: 'Notifikasi tidak ditemukan.' }, { status: 404 });
  return NextResponse.json(notification);
}
