import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getSessionByToken,
  hashPassword,
  SESSION_COOKIE,
  verifyPassword,
} from '@/lib/auth';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

async function resolveSessionToken(req?: NextRequest) {
  if (req) {
    return req.cookies.get(SESSION_COOKIE)?.value;
  }
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function GET(req?: NextRequest) {
  const token = await resolveSessionToken(req);
  const session = await getSessionByToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const now = new Date();
  const [userRecord, activeSessions, totalActivities, totalExecutions, recentActivities] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      include: {
        memberships: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                _count: { select: { projects: { where: { deletionState: 'ACTIVE' } } } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    db.session.findMany({
      where: { userId: session.user.id, expiresAt: { gt: now } },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    }),
    db.activityHistory.count({
      where: { actorUserId: session.user.id },
    }),
    db.activityHistory.count({
      where: { actorUserId: session.user.id, entityType: 'TestExecution' },
    }),
    db.activityHistory.findMany({
      where: { actorUserId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        project: { select: { id: true, name: true } },
      },
    }),
  ]);

  if (!userRecord) {
    return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const memberships = session.guest
    ? session.user.memberships.map((m) => ({
        id: m.id,
        role: 'GUEST',
        createdAt: m.createdAt,
        workspace: {
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          projectCount: session.guest?.projectIds.length ?? 0,
        },
      }))
    : userRecord.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        createdAt: m.createdAt,
        workspace: {
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          projectCount: m.workspace._count.projects,
        },
      }));

  return NextResponse.json(
    {
      profile: {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        isGuest: Boolean(session.guest || userRecord.isGuest),
        guestExpiresAt: session.guest?.expiresAt ?? null,
        createdAt: userRecord.createdAt,
        updatedAt: userRecord.updatedAt,
        memberships,
        sessions: activeSessions.map((s) => ({
          id: s.id,
          createdAt: s.createdAt,
          lastSeenAt: s.lastSeenAt,
          expiresAt: s.expiresAt,
          isCurrent: s.id === session.id,
        })),
        stats: {
          totalActivities,
          totalExecutions,
          workspaceCount: memberships.length,
          activeSessionCount: activeSessions.length,
        },
        recentActivities: recentActivities.map((act) => ({
          id: act.id,
          entityType: act.entityType,
          entityId: act.entityId,
          action: act.action,
          createdAt: act.createdAt,
          projectName: act.project?.name || 'Workspace',
        })),
      },
    },
    { headers: NO_STORE_HEADERS }
  );
}

export async function PATCH(req: NextRequest) {
  const token = await resolveSessionToken(req);
  const session = await getSessionByToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: NO_STORE_HEADERS });
  }
  if (session.guest || session.user.isGuest) {
    return NextResponse.json(
      { error: 'Akses tamu tidak dapat mengubah profil atau kredensial keamanan.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const action = String(body.action || 'update-profile');

  if (action === 'update-profile') {
    const rawName = String(body.name || '').trim();
    if (rawName.length < 2) {
      return NextResponse.json({ error: 'Nama tampilan minimal 2 karakter.' }, { status: 400, headers: NO_STORE_HEADERS });
    }
    if (rawName.length > 80) {
      return NextResponse.json({ error: 'Nama tampilan maksimal 80 karakter.' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const updated = await db.user.update({
      where: { id: session.user.id },
      data: { name: rawName },
      select: { id: true, name: true, email: true, updatedAt: true },
    });

    return NextResponse.json(
      { ok: true, message: 'Profil berhasil diperbarui.', user: updated },
      { headers: NO_STORE_HEADERS }
    );
  }

  if (action === 'change-password') {
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Password saat ini dan password baru wajib diisi.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const userRecord = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true },
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404, headers: NO_STORE_HEADERS });
    }

    const isCurrentValid = await verifyPassword(currentPassword, userRecord.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: 'Password saat ini tidak sesuai.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'Password baru harus berbeda dari password saat ini.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    let nextHash: string;
    try {
      nextHash = await hashPassword(newPassword);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Password baru tidak memenuhi syarat keamanan.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    await db.$transaction([
      db.user.update({
        where: { id: session.user.id },
        data: { passwordHash: nextHash },
      }),
      db.session.deleteMany({
        where: { userId: session.user.id, id: { not: session.id } },
      }),
    ]);

    return NextResponse.json(
      { ok: true, message: 'Password berhasil diperbarui dan sesi perangkat lain telah dicabut.' },
      { headers: NO_STORE_HEADERS }
    );
  }

  if (action === 'revoke-other-sessions') {
    const deleted = await db.session.deleteMany({
      where: { userId: session.user.id, id: { not: session.id } },
    });
    return NextResponse.json(
      {
        ok: true,
        revokedCount: deleted.count,
        message:
          deleted.count > 0
            ? `${deleted.count} sesi perangkat lain berhasil dicabut.`
            : 'Tidak ada sesi perangkat lain yang aktif.',
      },
      { headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json({ error: 'Tindakan profil tidak dikenali.' }, { status: 400, headers: NO_STORE_HEADERS });
}
