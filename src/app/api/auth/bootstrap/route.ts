import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createSession, hashPassword, isAllowedRequestOrigin, normalizeEmail, safeEqualText, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import { db } from '@/lib/db';

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'workspace';
}

export async function POST(req: NextRequest) {
  if (!isAllowedRequestOrigin(req.nextUrl, req.headers.get('origin'))) return NextResponse.json({ error: 'Origin request tidak diizinkan.' }, { status: 403 });
  if (await db.user.count()) return NextResponse.json({ error: 'Bootstrap sudah dinonaktifkan karena user telah tersedia.' }, { status: 409 });
  const expectedToken = process.env.QA_BOOTSTRAP_TOKEN || '';
  const body = await req.json().catch(() => ({}));
  if (!expectedToken || !safeEqualText(String(body.bootstrapToken || ''), expectedToken)) {
    return NextResponse.json({ error: 'Bootstrap token tidak valid. Atur QA_BOOTSTRAP_TOKEN pada host.' }, { status: 403 });
  }
  const email = normalizeEmail(body.email);
  const name = String(body.name || '').trim();
  const workspaceName = String(body.workspaceName || 'Local Workspace').trim();
  if (!email || !email.includes('@') || !name || !workspaceName) return NextResponse.json({ error: 'Nama, email, dan workspace wajib diisi.' }, { status: 400 });
  try {
    const passwordHash = await hashPassword(String(body.password || ''));
    const user = await db.$transaction(async tx => {
      const workspace = await tx.workspace.upsert({
        where: { slug: 'local-workspace' },
        update: { name: workspaceName },
        create: { name: workspaceName, slug: slugify(workspaceName) },
      });
      const created = await tx.user.create({ data: { email, name, passwordHash } });
      await tx.workspaceMembership.create({ data: { userId: created.id, workspaceId: workspace.id, role: 'OWNER' } });
      await tx.project.updateMany({ where: { workspaceId: 'local-workspace' }, data: { workspaceId: workspace.id } });
      return created;
    });
    const session = await createSession(user.id);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bootstrap gagal.' }, { status: 400 });
  }
}
