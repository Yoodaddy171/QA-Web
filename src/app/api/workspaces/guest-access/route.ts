import { NextRequest, NextResponse } from 'next/server';
import { getRequestActor } from '@/lib/request-actor';
import { createGuestAccess, listGuestAccess, revokeGuestAccess } from '@/lib/services/guest-access-service';
import { mutationFailure } from '@/lib/services/mutation-error';

const noStore = { 'Cache-Control': 'no-store' };
export async function GET(req: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const grants = await listGuestAccess(actor.userId, req.nextUrl.searchParams.get('workspaceId') || '');
    return NextResponse.json({ grants }, { headers: noStore });
  } catch (error) { const failure = mutationFailure(error, 'List guest access', 'Gagal membaca akses tamu.'); return NextResponse.json({ error: failure.error }, { status: failure.status, headers: noStore }); }
}
export async function POST(req: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const result = await createGuestAccess(actor.userId, await req.json());
    return NextResponse.json(result, { status: 201, headers: noStore });
  } catch (error) { const failure = mutationFailure(error, 'Create guest access', 'Gagal membuat akses tamu.'); return NextResponse.json({ error: failure.error }, { status: failure.status, headers: noStore }); }
}
export async function PATCH(req: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const body = await req.json();
    const result = await revokeGuestAccess(actor.userId, String(body.workspaceId || ''), String(body.id || ''));
    return NextResponse.json(result, { headers: noStore });
  } catch (error) { const failure = mutationFailure(error, 'Revoke guest access', 'Gagal mencabut akses tamu.'); return NextResponse.json({ error: failure.error }, { status: failure.status, headers: noStore }); }
}
