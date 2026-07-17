import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, hasMinimumRole, isWorkspaceRole, normalizeEmail } from '@/lib/auth';
import { db } from '@/lib/db';
import { getRequestActor } from '@/lib/request-actor';

async function adminActor() {
  const actor = await getRequestActor();
  return actor && hasMinimumRole(actor.role, 'ADMIN') ? actor : null;
}

export async function GET() {
  const actor = await adminActor();
  if (!actor) return NextResponse.json({ error: 'Admin workspace diperlukan.' }, { status: 403 });
  const members = await db.workspaceMembership.findMany({
    where: { workspaceId: actor.workspaceId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true, disabledAt: true } } },
  });
  return NextResponse.json({ members, actorRole: actor.role });
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
      if (user.disabledAt) throw new Error('User ini sedang dinonaktifkan.');
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
  const membershipId = String(body.membershipId || '').trim();
  const role = String(body.role || '');
  if (!membershipId || !isWorkspaceRole(role)) return NextResponse.json({ error: 'Membership dan role wajib diisi.' }, { status: 400 });
  const current = await db.workspaceMembership.findFirst({ where: { id: membershipId, workspaceId: actor.workspaceId } });
  if (!current) return NextResponse.json({ error: 'Member tidak ditemukan.' }, { status: 404 });
  if ((current.role === 'OWNER' || role === 'OWNER') && actor.role !== 'OWNER') return NextResponse.json({ error: 'Hanya owner yang dapat mengubah role owner.' }, { status: 403 });
  if (current.role === 'OWNER' && role !== 'OWNER') {
    const owners = await db.workspaceMembership.count({ where: { workspaceId: actor.workspaceId, role: 'OWNER' } });
    if (owners <= 1) return NextResponse.json({ error: 'Workspace harus memiliki minimal satu owner.' }, { status: 409 });
  }
  const member = await db.workspaceMembership.update({ where: { id: current.id }, data: { role }, select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true, disabledAt: true } } } });
  return NextResponse.json({ member });
}

export async function DELETE(req: NextRequest) {
  const actor = await adminActor();
  if (!actor) return NextResponse.json({ error: 'Admin workspace diperlukan.' }, { status: 403 });
  const membershipId = req.nextUrl.searchParams.get('membershipId')?.trim();
  if (!membershipId) return NextResponse.json({ error: 'membershipId wajib diisi.' }, { status: 400 });
  const current = await db.workspaceMembership.findFirst({ where: { id: membershipId, workspaceId: actor.workspaceId } });
  if (!current) return NextResponse.json({ error: 'Member tidak ditemukan.' }, { status: 404 });
  if (current.role === 'OWNER') {
    if (actor.role !== 'OWNER') return NextResponse.json({ error: 'Hanya owner yang dapat menghapus owner.' }, { status: 403 });
    const owners = await db.workspaceMembership.count({ where: { workspaceId: actor.workspaceId, role: 'OWNER' } });
    if (owners <= 1) return NextResponse.json({ error: 'Workspace harus memiliki minimal satu owner.' }, { status: 409 });
  }
  await db.workspaceMembership.delete({ where: { id: current.id } });
  await db.session.deleteMany({ where: { userId: current.userId } });
  return NextResponse.json({ deleted: 1 });
}
