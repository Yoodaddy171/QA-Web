import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, hasMinimumRole, isWorkspaceRole, normalizeEmail } from '@/lib/auth';
import { db } from '@/lib/db';
import { getRequestActor } from '@/lib/request-actor';
import { listWorkspaceMembers, removeWorkspaceMember, updateWorkspaceMember } from '@/lib/services/workspace-member-service';
import { mutationFailure } from '@/lib/services/mutation-error';

async function adminActor() {
  const actor = await getRequestActor();
  return actor && hasMinimumRole(actor.role, 'ADMIN') ? actor : null;
}

export async function GET() {
  const actor = await adminActor();
  if (!actor) return NextResponse.json({ error: 'Admin workspace diperlukan.' }, { status: 403 });
  try { return NextResponse.json(await listWorkspaceMembers(actor.userId, actor.workspaceId), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return memberError(error); }
}

export async function POST(req: NextRequest) {
  const actor = await adminActor();
  if (!actor) return NextResponse.json({ error: 'Admin workspace diperlukan.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const name = String(body.name || '').trim();
  const role = String(body.role || 'QA');
  if (!email.includes('@') || !name || !isWorkspaceRole(role)) return NextResponse.json({ error: 'Nama, email, dan role valid wajib diisi.' }, { status: 400 });
  if (role === 'OWNER' && actor.role !== 'OWNER') return NextResponse.json({ error: 'Hanya owner yang dapat menambahkan owner.' }, { status: 403 });

  try {
    const member = await db.$transaction(async tx => {
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        const passwordHash = await hashPassword(String(body.password || ''));
        user = await tx.user.create({ data: { email, name, passwordHash } });
      }
      if (user.disabledAt || user.isGuest) throw new Error('Identitas ini tidak dapat ditambahkan sebagai member.');
      return tx.workspaceMembership.create({
        data: { workspaceId: actor.workspaceId, userId: user.id, role },
        select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true, disabledAt: true } } },
      });
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal menambah member.' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await adminActor();
  if (!actor) return NextResponse.json({ error: 'Admin workspace diperlukan.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try { return NextResponse.json(await updateWorkspaceMember(actor.userId, actor.workspaceId, body), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return memberError(error); }
}

export async function DELETE(req: NextRequest) {
  const actor = await adminActor();
  if (!actor) return NextResponse.json({ error: 'Admin workspace diperlukan.' }, { status: 403 });
  const membershipId = req.nextUrl.searchParams.get('membershipId')?.trim();
  try { return NextResponse.json(await removeWorkspaceMember(actor.userId, actor.workspaceId, membershipId || ''), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return memberError(error); }
}

function memberError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: 'Email sudah digunakan akun lain.' }, { status: 409 });
  const result = mutationFailure(error, 'Workspace member mutation failed', 'Perubahan akun gagal. Muat ulang team lalu coba lagi.');
  return NextResponse.json({ error: result.error }, { status: result.status });
}
